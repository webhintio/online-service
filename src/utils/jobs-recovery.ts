import * as _ from 'lodash';

import { JobStatus } from '../lib/enums/status';
import { IJob } from '../lib/types';
import * as logger from '../lib/utils/logging';
import * as db from '../lib/common/database/database';
import { Queue } from '../lib/common/queue/queue';

let queue: Queue = null;

const moduleName = 'Jobs Recovery';
const { database, queue: queueConnectionString } = process.env; // eslint-disable-line no-process-env

const connectDatabase = () => {
    return db.connect(database);
};

const parseJob = (job: IJob) => {
    const result: IJob = {
        config: job.config,
        error: job.error,
        finished: job.finished,
        id: job.id,
        investigated: job.investigated,
        maxRunTime: job.maxRunTime,
        messagesInQueue: job.messagesInQueue,
        partInfo: job.partInfo,
        queued: job.queued,
        rules: job.rules,
        sonarVersion: job.sonarVersion,
        started: job.started,
        status: job.status,
        url: job.url
    };

    return result;
};

/**
 * Split the job in as many messages as configurations it has.
 * @param {IJob} job - Job to send to the queue.
 */
const sendMessagesToQueue = async (job: IJob) => {
    let counter = 0;

    logger.log(`Splitting the Job in ${job.config.length} tasks`, moduleName);

    for (const config of job.config) {
        const jobCopy = parseJob(_.cloneDeep(job));

        jobCopy.partInfo = {
            part: ++counter,
            totalParts: job.config.length
        };
        jobCopy.config = [config];
        await queue.sendMessage(jobCopy);
        logger.log(`Part ${jobCopy.partInfo.part} of ${jobCopy.partInfo.totalParts} sent to the Service Bus`, moduleName);
    }
};

const run = async () => {
    try {
        queue = new Queue('sonar-jobs', queueConnectionString);
        await connectDatabase();
    } catch (err) {
        logger.error(err, moduleName);

        return;
    }

    try {
        const unFinishedJobs: Array<IJob> = await db.job.getUnfinished();

        for (const job of unFinishedJobs) {
            // Just doble check
            if (job.status !== JobStatus.pending && job.status !== JobStatus.started) {
                continue; // eslint-disable-line no-continue
            }

            try {
                await sendMessagesToQueue(job);
            } catch (err) {
                logger.error(`Error sending job ${job.id} to the queue`, moduleName, err);
            }
        }
    } catch (err) {
        logger.error(`Error recovering jobs`, moduleName, err);
    }
};

if (process.argv[1].includes('jobs-recovery.js')) {
    run();
}
