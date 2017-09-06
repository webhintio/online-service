import { Queue } from '../../common/queue/queue';
import * as database from '../../common/database/database';
import { IJobModel } from '../../common/database/models/job';
import { IJob, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';

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

        dbJobRule.messages = rule.messages;
        dbJobRule.status = rule.status;
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
        const lock = await database.lock(job.id);

        const dbJob: IJobModel = await database.getJob(job.id);

        if (!dbJob) {
            logger.error(`Job ${job.id} not found in database`);
            await database.unlock(lock);

            return;
        }

        // If the job fails at some point, ignore other messages.
        // This can happen if for example we split the job in 
        // some groups of rules to run just a subset in each worker
        // and for some reason, one of the execution fails.
        if (dbJob.status === JobStatus.error) {
            await database.unlock(lock);

            return;
        }

        if (job.status === JobStatus.started) {
            dbJob.started = job.started;

            // double check just in case the started message is not the first one we are processing.
            if (dbJob.status === JobStatus.pending) {
                dbJob.status = job.status;
            }
        } else {
            setRules(dbJob, job);

            if (job.status === JobStatus.error) {
                dbJob.status = job.status;
                dbJob.finished = job.finished;
                dbJob.error = job.error;
            } else if (isJobFinished(dbJob)) {
                dbJob.finished = job.finished;
                dbJob.status = job.status;
            }
        }

        await database.updateJob(dbJob);
        await database.unlock(lock);
    };

    try {
        await queueResults.listen(listener);
        await database.disconnect();

        return 0;
    } catch (err) {
        return 1;
    }
};

if (process.argv[1].includes('sync-service.js')) {
    run();
}
