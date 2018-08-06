import * as _ from 'lodash';

import { Queue } from '../../common/queue/queue';
import * as database from '../../common/database/database';
import { IJobModel } from '../../common/database/models/job';
import { IJob, Hint } from '../../types';
import { JobStatus, HintStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';
import * as appInsight from '../../utils/appinsights';

const moduleName: string = 'Sync Service';
const {database: dbConnectionString, queue: queueConnectionString} = process.env; // eslint-disable-line no-process-env
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

/**
 * Run the sync service.
 */
export const run = async () => {
    const queueResults = new Queue('sonar-results', queueConnectionString);

    await database.connect(dbConnectionString);

    const listener = async (jobsArray: Array<IJob>) => {
        try {
            const start = Date.now();
            const groups = _.groupBy(jobsArray, 'id');

            logger.log(`Synchronizing ${jobsArray.length} jobs messages in ${Object.entries(groups).length} groups`, moduleName);

            for (const [id, jobs] of Object.entries(groups)) {
                const lock = await database.lock(id);
                const dbJob: IJobModel = await database.job.get(id);

                if (!dbJob) {
                    logger.error(`Job ${id} not found in database`, moduleName);
                    await database.unlock(lock);

                    appInsightClient.trackException({ exception: new Error(`Job ${id} not found in database`) });

                    continue; // eslint-disable-line no-continue
                }

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

                    logger.log(generateLog(`Synchronized Job`, job, { showHint: true }), moduleName);
                }

                await database.job.update(dbJob);

                logger.log(`Job ${id} updated in database`);

                await database.unlock(lock);
            }

            appInsightClient.trackMetric({
                name: 'run-webhint',
                value: Date.now() - start
            });
        } catch (err) {
            appInsightClient.trackException({ exception: err });

            throw err;
        }
    };

    try {
        await queueResults.listen(listener, { messagesToGet: 50 });
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
