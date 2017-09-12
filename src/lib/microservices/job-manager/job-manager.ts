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

const debug: debug.IDebugger = d(__filename);
const queue: Queue = new Queue('sonar-jobs', process.env.queue); // eslint-disable-line no-process-env

/**
 * Create a new Job in the database.
 * @param {string} url - The url that the job will be use.
 * @param {IConfig} config - The configuration for the job.
 */
const createNewJob = async (url: string, config: IConfig, jobRunTime: number): Promise<IJob> => {
    const normalizedRules = normalizeRules(config.rules);
    const rules: Array<Rule> = _.map(normalizedRules, (rule: string, key: string) => {
        return {
            messages: [],
            name: key,
            status: RuleStatus.pending
        };
    });

    const databaseJob = await database.newJob(url, JobStatus.pending, rules, config, jobRunTime);

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
 * Create an object with all the rules and the default error level.
 * @param {Array<string>} rules - Array with names of rules.
 */
const createRules = (rules: Array<string>) => {
    const result = {};

    for (const rule of rules) {
        result[rule] = RuleStatus.error;
    }

    return result;
};

/**
 * Get the right configuration for the job.
 * @param {RequestData} data - The data the user sent in the request.
 */
const getConfig = (data: RequestData, serviceConfig: IServiceConfig) => {
    const source: ConfigSource = data.source;
    let config: IConfig;

    debug(`Configuration source: ${source}`);
    switch (source) {
        case ConfigSource.file:
            config = data.config;
            break;
        case ConfigSource.manual:
            config = serviceConfig.sonarConfig;
            config.rules = createRules(data.rules);
            break;
        default:
            config = serviceConfig.sonarConfig;
            break;
    }

    return config;
};

/**
 * Get a Job that it is still valid.
 * @param {Array<IJob>} jobs - All the jobs for that url in the database.
 * @param config - Job configuration.
 */
const getActiveJob = (jobs: Array<IJob>, config: IConfig, cacheTime: number) => {

    return jobs.find((job) => {
        // job.config in cosmosdb is undefined if the config saved was an empty object.
        return _.isEqual(job.config || {}, config) && (!job.finished || moment(job.finished).isAfter(moment().subtract(cacheTime, 'seconds')));
    });
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

    const config: IConfig = getConfig(data, serviceConfig);
    const jobs: Array<IJob> = await database.getJobsByUrl(data.url);
    let job = getActiveJob(jobs, config, serviceConfig.jobCacheTime);

    if (jobs.length === 0 || !job) {
        job = await createNewJob(data.url, config, serviceConfig.jobRunTime);
        await queue.sendMessage(job);
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
