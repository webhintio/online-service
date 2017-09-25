import * as _ from 'lodash';
import * as moment from 'moment';
import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';

import * as database from '../../common/database/database';
import * as configManager from '../config-manager/config-manager';
import { IJob, IServiceConfig, RequestData, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import { ConfigSource } from '../../enums/configsource';
import { Queue } from '../../common/queue/queue';
import { debug as d } from '../../utils/debug';
import { validateServiceConfig } from '../../utils/misc';
import * as logger from '../../utils/logging';

const debug: debug.IDebugger = d(__filename);
const queue: Queue = new Queue('sonar-jobs', process.env.queue); // eslint-disable-line no-process-env
const moduleName: string = 'Job Manager';

/**
 * Create a new Job in the database.
 * @param {string} url - The url that the job will be use.
 * @param {IConfig} config - The configuration for the job.
 */
const createNewJob = async (url: string, configs: Array<IConfig>, jobRunTime: number): Promise<IJob> => {
    let rules: Array<Rule> = [];

    for (const config of configs) {
        const normalizedRules = normalizeRules(config.rules);
        const partialRules = _.map(normalizedRules, (rule: string, key: string) => {
            return {
                messages: [],
                name: key,
                status: RuleStatus.pending
            };
        });

        rules = rules.concat(partialRules);
    }

    const databaseJob = await database.newJob(url, JobStatus.pending, rules, configs, jobRunTime);

    return {
        config: databaseJob.config,
        error: databaseJob.error,
        finished: databaseJob.finished,
        id: databaseJob.id,
        maxRunTime: databaseJob.maxRunTime,
        queued: databaseJob.queued,
        rules: databaseJob.rules,
        sonarVersion: null,
        started: databaseJob.started,
        status: databaseJob.status,
        url: databaseJob.url
    };
};

/**
 * Validate if a sonar configuration or an array of them is valid.
 * @param {IConfig | Array<IConfig>} config - Sonar configuration.
 */
const validateConfigs = (config: IConfig | Array<IConfig>) => {
    const configs = Array.isArray(config) ? config : [config];

    validateServiceConfig(configs);
};

/**
 * Get the right configuration for the job.
 * @param {RequestData} data - The data the user sent in the request.
 */
const getConfig = (data: RequestData, serviceConfig: IServiceConfig): Array<IConfig> => {
    const source: ConfigSource = data.source;
    let config: Array<IConfig>;

    debug(`Configuration source: ${source}`);
    switch (source) {
        case ConfigSource.file:
            validateConfigs(data.config);
            config = Array.isArray(data.config) ? data.config : [data.config];
            break;
        // TODO: TBD.
        // case ConfigSource.manual:
        default:
            config = serviceConfig.sonarConfigs;
            break;
    }

    return config;
};

/**
 * Get a Job that it is still valid.
 * @param {Array<IJob>} jobs - All the jobs for that url in the database.
 * @param config - Job configuration.
 */
const getActiveJob = (jobs: Array<IJob>, config: Array<IConfig>, cacheTime: number) => {
    return jobs.find((job) => {
        // job.config in cosmosdb is undefined if the config saved was an empty object.
        return _.isEqual(job.config || [{}], config) && (!job.finished || moment(job.finished).isAfter(moment().subtract(cacheTime, 'seconds')));
    });
};

/**
 * Split the job in as many messages as configurations it has.
 * @param {IJob} job - Job to send to the queue.
 */
const sendMessagesToQueue = async (job: IJob) => {
    let counter = 0;

    logger.log(`Splitting the Job in ${job.config.length} tasks`, moduleName);

    for (const config of job.config) {
        const jobCopy = _.cloneDeep(job);

        jobCopy.part = ++counter;
        jobCopy.totalParts = job.config.length;
        jobCopy.config = [config];
        await queue.sendMessage(jobCopy);
        logger.log(`Part ${jobCopy.part} of ${jobCopy.totalParts} sent to the Service Bus`, moduleName);
    }
};

/**
 * Create a new job into the database and into the queue to process the request.
 * @param {RequestData} data - The data the user sent in the request.
 */
export const startJob = async (data: RequestData): Promise<IJob> => {
    /*
        1. Lock database by url
        2. Check if the job exists having into account if the configuration is the same
            a) If the job exists
                I) The job is obsolete
                    i) Create a new job
                    ii) Add job to the queue
                II) The job isn't obsolte => return existing job
            b) If the job doesn't exist
                I) Create a new job
                II) Add job to the queue
        3. Unlock database by url
     */
    const serviceConfig: IServiceConfig = await configManager.getActiveConfiguration();
    const lock = await database.lock(data.url);

    const config: Array<IConfig> = getConfig(data, serviceConfig);
    const jobs: Array<IJob> = await database.getJobsByUrl(data.url);
    let job = getActiveJob(jobs, config, serviceConfig.jobCacheTime);

    if (jobs.length === 0 || !job) {
        logger.log('Active job not found, creating a new job', moduleName);

        job = await createNewJob(data.url, config, serviceConfig.jobRunTime);

        logger.log(`Created new Job with id ${job.id}`, moduleName);

        try {
            job.messagesInQueue = await queue.getMessagesCount();
            await sendMessagesToQueue(job);

            logger.log(`all messages sent to Service Bus`, moduleName);
        } catch (err) {
            // Update the job status to Error.
            const dbJob = await database.getJob(job.id);

            dbJob.status = JobStatus.error;
            dbJob.finished = new Date();
            if (err instanceof Error) {
                dbJob.error = JSON.stringify({
                    message: err.message,
                    stack: err.stack
                });
            } else {
                dbJob.error = JSON.stringify(err);
            }

            await database.updateJob(dbJob);
        }
    }

    await database.unlock(lock);

    return job;
};

/**
 * Get the job status.
 * @param {string} jobId - The id for the job the user wants to check.
 */
export const getJob = (jobId: string): Promise<IJob> => {
    return database.getJob(jobId);
};
