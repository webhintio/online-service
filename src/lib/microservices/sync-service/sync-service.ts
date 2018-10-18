import * as _ from 'lodash';
import * as moment from 'moment';

import { Queue } from '../../common/queue/queue';
import * as database from '../../common/database/database';
import { IJobModel } from '../../common/database/models/job';
import { IssueReporter } from '../../common/github/issuereporter';
import { IJob, Hint, ServiceBusMessage } from '../../types';
import { JobStatus, HintStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';
import * as appInsight from '../../utils/appinsights';
import { IssueData } from '../../types/issuedata';

const moduleName: string = 'Sync Service';
const { database: dbConnectionString, queue: queueConnectionString, messagestoget } = process.env; // eslint-disable-line no-process-env
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

/**
 * Run the sync service.
 */
export const run = async () => {
    const queueResults = new Queue('sonar-results', queueConnectionString);

    await database.connect(dbConnectionString);

    const syncJobs = async (id: string, serviceBusMessages: Array<ServiceBusMessage>) => {
        let lock;

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

        const dbJob: IJobModel = await database.job.get(id);

        if (!dbJob) {
            logger.error(`Job ${id} not found in database`, moduleName);
            await database.unlock(lock);

            /*
             * Delete messages from the queue
             */
            for (const message of serviceBusMessages) {
                await queueResults.deleteMessage(message);
            }

            appInsightClient.trackException({ exception: new Error(`Job ${id} not found in database`) });

            return; // eslint-disable-line no-continue
        }

        const jobs: Array<IJob> = _.map(serviceBusMessages, (message) => {
            return message.data;
        });

        for (const job of jobs) {
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

                dbJob.log += job.log;

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
        }

        await database.job.update(dbJob);

        logger.log(`Job ${id} updated in database`);

        /*
         * Delete messages from the queue
         */
        for (const message of serviceBusMessages) {
            await queueResults.deleteMessage(message);
        }

        await database.unlock(lock);
    };

    const listener = async (messages: Array<ServiceBusMessage>) => {
        try {
            const start = Date.now();

            const groups = _.groupBy(messages, (message) => {
                return message.data.id;
            });

            logger.log(`Synchronizing ${messages.length} jobs messages in ${Object.entries(groups).length} groups`, moduleName);

            const promises: Array<Promise<void>> = [];

            const syncJobsStart = Date.now();

            for (const [id, serviceBusMessages] of Object.entries(groups)) {
                promises.push(syncJobs(id, serviceBusMessages));
            }

            await Promise.all(promises);

            logger.log(`Time to sync ${messages.length} jobs in ${Object.entries(groups).length} groups: ${(Date.now() - syncJobsStart) / 1000} seconds`, moduleName);

            appInsightClient.trackMetric({
                name: 'run-webhint-sync',
                value: Date.now() - start
            });
        } catch (err) {
            appInsightClient.trackException({ exception: err });

            throw err;
        }
    };

    try {
        await queueResults.listen(listener, {
            autoDeleteMessages: false,
            messagesToGet: parseInt(messagestoget, 10) || 50
        });
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
