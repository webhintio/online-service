import * as url from 'url';

import { Sonar } from '@sonarwhal/sonar/dist/src/lib/sonar';

import { IJob, JobResult } from '../../types';
import * as logger from '../../utils/logging';

/**
 * Run a Job in sonar.
 * @param {IJob} job - Job to run in sonar.
 */
const run = async (job: IJob) => {
    logger.log(`Running job: ${job.id}`);
    const result: JobResult = {
        error: null,
        messages: null,
        ok: null
    };

    try {
        const sonar = new Sonar(job.config);

        result.messages = await sonar.executeOn(url.parse(job.url));

        result.ok = true;
    } catch (err) {
        logger.error(`Error runing job ${job.id}`, err);
        result.error = err;
        result.messages = null;
        result.ok = false;
    }
    logger.log(`Sending result for job ${job.id}`);
    process.send(result);
};

process.on('message', run);
