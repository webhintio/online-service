import { Queue } from '../../common/queue/queue';
import * as database from '../../common/database/database';
import { IJobModel } from '../../common/database/models/job';
import { IJob, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';

const moduleName: string = 'Sync Service';
/**
 * Get a rule from rules given a rule name.
 * @param {string} name Name of the rule to get.
 * @param {Array<Rule>} rules Rules where to find the rule name.
 */
const getRule = (name: string, rules: Array<Rule>) => {
    return rules.find((rule) => {
        return rule.name === name;
    });
};

/**
 * Update the rules statuses and messages in dbJob.
 * @param {IJob} dbJob Job from database.
 * @param {IJob} job Job from service bus.
 */
const setRules = (dbJob: IJob, job: IJob) => {
    for (const rule of job.rules) {
        const dbJobRule = getRule(rule.name, dbJob.rules);

        if (dbJobRule.status === RuleStatus.pending) {
            dbJobRule.messages = rule.messages;
            dbJobRule.status = rule.status;
        }
    }
};

/**
 * Check if a job finish the scan.
 * @param {IJob} job Job to check if it is finished or not.
 */
const isJobFinished = (job: IJob) => {
    return job.rules.every((rule) => {
        return rule.status !== RuleStatus.pending;
    });
};

/**
 * Run the sync service.
 */
export const run = async () => {
    const queueResults = new Queue('sonar-results', process.env.queue); // eslint-disable-line no-process-env

    await database.connect(process.env.database); // eslint-disable-line no-process-env

    const listener = async (job: IJob) => {
        logger.log(generateLog(`Synchronizing Job`, job, { showRule: true }), moduleName);
        const lock = await database.lock(job.id);

        const dbJob: IJobModel = await database.getJob(job.id);

        if (!dbJob) {
            logger.error(`Job ${job.id} not found in database`, moduleName);
            await database.unlock(lock);

            return;
        }

        if (job.status === JobStatus.started) {
            // When a job is split we receive more than one messages for the status `started`
            // but we only want to store in the database the first one.
            if (dbJob.status !== JobStatus.started) {
                dbJob.sonarVersion = job.sonarVersion;
            }

            if (!dbJob.started || dbJob.started > new Date(job.started)) {
                dbJob.started = job.started;
            }

            // double check just in case the started message is not the first one we are processing.
            if (dbJob.status === JobStatus.pending) {
                dbJob.status = job.status;
            }
        } else {
            setRules(dbJob, job);

            if (job.status === JobStatus.error) {
                if (!dbJob.error) {
                    dbJob.error = [];
                }
                dbJob.error.push(job.error);
            }

            if (isJobFinished(dbJob)) {
                dbJob.status = dbJob.error && dbJob.error.length > 0 ? JobStatus.error : job.status;
            }

            if (!dbJob.finished || dbJob.finished < new Date(job.finished)) {
                dbJob.finished = job.finished;
            }
        }

        await database.updateJob(dbJob);
        await database.unlock(lock);

        logger.log(generateLog(`Synchronized Job`, job, { showRule: true }), moduleName);
    };

    try {
        await queueResults.listen(listener);
        await database.disconnect();
        logger.log('Service finished\nExiting with status 0', moduleName);

        return 0;
    } catch (err) {
        logger.error('Error in Sync service\nExiting with status 1', moduleName);

        return 1;
    }
};

if (process.argv[1].includes('sync-service.js')) {
    run();
}
