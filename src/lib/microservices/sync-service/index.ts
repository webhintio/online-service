import { AzureFunction, Context } from '@azure/functions';
import * as _ from 'lodash';
import * as moment from 'moment';

import * as database from '../../common/database/database';
import { IJobModel } from '../../common/database/models/job';
import { IssueReporter } from '../../common/github/issuereporter';
import { IJob, Hint } from '../../types';
import { JobStatus, HintStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';
import * as appInsight from '../../utils/appinsights';
import { IssueData } from '../../types/issuedata';

const moduleName: string = 'Sync Function';
const { database: Database } = process.env; // eslint-disable-line no-process-env
const appInsightClient = appInsight.getClient();

/**
 * Get a hint from hints given a hint name.
 * @param {string} name Name of the hint to get.
 * @param {Array<Hint>} hints Hints where to find the hint name.
 */
const getHint = (name: string, hints: Array<Hint>) => {
    return hints.find((hint) => {
        return hint.name === name;
    });
};

/**
 * Update the hints statuses and messages in dbJob.
 * @param {IJob} dbJob Job from database.
 * @param {IJob} job Job from service bus.
 */
const setHints = (dbJob: IJob, job: IJob) => {
    for (const hint of job.hints) {
        const dbJobHint = getHint(hint.name, dbJob.hints);

        if (dbJobHint.status === HintStatus.pending) {
            dbJobHint.messages = hint.messages;
            dbJobHint.status = hint.status;
        }
    }
};

/**
 * Check if a job finish the scan.
 * @param {IJob} job Job to check if it is finished or not.
 */
const isJobFinished = (job: IJob) => {
    return job.hints.every((hint) => {
        return hint.status !== HintStatus.pending;
    });
};

const reportGithubIssues = async (job: IJob) => {
    try {
        const issueReporter = new IssueReporter();
        const errors = Array.isArray(job.error) ? job.error : [job.error];

        for (const error of errors) {
            const errorMessage = JSON.stringify(error.message || error);
            const issueData: IssueData = {
                configs: job.config,
                errorMessage,
                errorType: 'crash',
                log: job.log,
                scan: moment().format('YYYY-MM-DD'),
                url: job.url
            };

            await issueReporter.report(issueData);

            logger.log('Reported to GitHub successfully', moduleName);
        }
    } catch (err) {
        logger.error('Error reporting to GitHub', moduleName);
        logger.error(err, moduleName);
    }
};

const reportGithubTimeoutIssues = async (job: IJob) => {
    try {
        /*
         * In case of timeout, all the rules will have
         * the same error.
         */
        const hint = job.hints[0];
        const expectedMessage = `webhint didn't return the result fast enough`;
        const message = hint.messages && hint.messages[0] && hint.messages[0].message;

        if (message && message.includes(expectedMessage)) {
            const issueReporter: IssueReporter = new IssueReporter();
            const issueData: IssueData = {
                configs: job.config,
                errorMessage: message,
                errorType: 'timeout',
                log: job.log,
                scan: moment().format('YYYY-MM-DD'),
                url: job.url
            };

            await issueReporter.report(issueData);

            logger.log('Reported to GitHub successfully', moduleName);
        }
    } catch (err) {
        logger.error('Error reporting to GitHub', moduleName);
        logger.error(err, moduleName);
    }
};

const closeGithubIssues = async (dbJob: IJobModel) => {
    try {
        const expectedMessage = `webhint didn't return the result fast enough`;

        // Check first if there was any timeout.
        const someTimeout = dbJob.hints.some((hint) => {
            const message = hint.messages && hint.messages[0] && hint.messages[0].message;

            return message && message.includes(expectedMessage);
        });

        if (!someTimeout) {
            const issueReporter: IssueReporter = new IssueReporter();
            const issueData: IssueData = {
                scan: moment().format('YYYY-MM-DD'),
                url: dbJob.url
            };

            await issueReporter.report(issueData);

            logger.log('Issue closed successfully', moduleName);
        }
    } catch (err) {
        logger.error('Error closing issue on GitHub', moduleName);
        logger.error(err, moduleName);
    }
};

const run: AzureFunction = async (context: Context, job: IJob): Promise<void> => {
    await database.connect(Database);

    const id = job.id;
    let lock: any;

    try {
        lock = await database.lock(id);
    } catch (e) {
        logger.error(`It was not possible lock the id ${id}`, moduleName, e);
        lock = null;
    }

    if (!lock) {
        /*
        * If we are not able to lock the job in the database, keep
        * the item locked in the queue until the timeout (in the queue)
        * expire.
        */

        return;
    }

    let error = false;

    try {
        const dbJob: IJobModel = await database.job.get(id);

        if (!dbJob) {
            logger.error(`Job ${id} not found in database`, moduleName);
            await database.unlock(lock);

            appInsightClient.trackException({ exception: new Error(`Job ${id} not found in database`) });

            return;
        }

        logger.log(generateLog(`Synchronizing Job`, job, { showHint: true }), moduleName);

        if (job.status === JobStatus.started) {
            // When a job is split we receive more than one messages for the status `started`
            // but we only want to store in the database the first one.
            if (dbJob.status !== JobStatus.started) {
                dbJob.webhintVersion = job.webhintVersion;
            }

            if (!dbJob.started || dbJob.started > new Date(job.started)) {
                dbJob.started = job.started;
            }

            // double check just in case the started message is not the first one we are processing.
            if (dbJob.status === JobStatus.pending) {
                dbJob.status = job.status;
            }
        } else {
            setHints(dbJob, job);

            if (!dbJob.log) {
                dbJob.log = '';
            }

            if (job.log) {
                dbJob.log += `${job.log}\n`;
            }

            if (job.status === JobStatus.error) {
                if (!dbJob.error) {
                    dbJob.error = [];
                }
                dbJob.error.push(job.error);
                await reportGithubIssues(job);
            } else {
                await reportGithubTimeoutIssues(job);
            }

            if (isJobFinished(dbJob)) {
                dbJob.status = dbJob.error && dbJob.error.length > 0 ? JobStatus.error : job.status;

                if (dbJob.status === JobStatus.finished) {
                    await closeGithubIssues(dbJob);
                }
            }

            if (!dbJob.finished || dbJob.finished < new Date(job.finished)) {
                dbJob.finished = job.finished;
            }
        }

        logger.log(generateLog(`Synchronized Job`, job, { showHint: true }), moduleName);
        await database.job.update(dbJob);
        logger.log(`Job ${id} updated in database`);
    } catch (err) {
        error = true;
        logger.log(`Error updating database for Job ${id}: ${err.message}`);
    } finally {
        await database.unlock(lock);
        await database.disconnect();
        logger.log(`Service finished with${error ? '' : 'out'} error(s)`, moduleName);

    }
};

export default run;
