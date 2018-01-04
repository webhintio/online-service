import * as uuid from 'uuid/v4';

import { IConfig } from 'sonarwhal/dist/src/lib/types';
import { DocumentQuery } from 'mongoose';

import { debug as d } from '../../../utils/debug';
import { IJob } from '../../../types';
import { IJobModel, Job } from '../models/job';
import { JobStatus } from '../../../enums/status';
import { Rule, StatOptions, StatQueryParameter } from '../../../types';
import { validateConnection } from './common';
import { getTime } from '../../ntp/ntp';

const debug: debug.IDebugger = d(__filename);

/**
 * Get all the jobs from the database for a given url.
 * @param {string} url - Url we want to look for.
 */
export const getByUrl = async (url: string): Promise<Array<IJob>> => {
    validateConnection();

    debug(`Getting jobs by url: ${url}`);
    const query = Job.find({ url });

    const jobs = await query.exec();

    debug(`${jobs.length} found for the url ${url}`);

    return jobs;
};

/**
 * Get a job from the database.
 * @param {string} id - Id we want to look for.
 */
export const get = async (id: string): Promise<IJobModel> => {
    validateConnection();

    debug(`Getting job by id: ${id}`);
    const query = Job.findOne({ id });

    const job: IJobModel = await query.exec();

    debug(`job with id ${id} ${job ? 'found' : 'not found'}`);

    return job;
};

/**
 * Create a new Job into the database.
 * @param {string} url - Url for the job.
 * @param {JobStatus} status - Current status for the job.
 * @param {Array<rules>} rules - Rules the job will check.
 * @param config - Configuration for the job.
 */
export const add = async (url: string, status: JobStatus, rules: Array<Rule>, config: Array<IConfig>, jobRunTime: number): Promise<IJob> => {
    validateConnection();

    debug(`Creating new job for url: ${url}`);

    const job = new Job({
        config,
        id: uuid(),
        maxRunTime: jobRunTime,
        queued: await getTime(),
        rules,
        status,
        url
    });

    await job.save();

    debug(`job for url ${url} saved in database `);

    return job;
};

/**
 * Update a job in database.
 * @param {IJobModel} job Job we want to update.
 */
export const update = async (job: IJobModel) => {
    validateConnection();

    job.markModified('rules');

    await job.save();
};

/**
 * Update a property in a job.
 * @param jobId - ID for the job to update.
 * @param property - Property to update.
 * @param value - New value for the property.
 */
export const updateProperty = (jobId: string, property: string, value): Promise<IJob> => {
    validateConnection();

    return Job.findOneAndUpdate({ id: jobId }, { $set: { [property]: value } }).exec();
};

/**
 * Get all jobs between two dates using an specific field.
 * @param {string} field - Field to filter.
 * @param {Date} from - Initial date.
 * @param {Date} to - End date.
 */
export const getByDate = async (field: string, from: Date, to: Date): Promise<Array<IJob>> => {
    validateConnection();

    const x = {
        [field]: {
            $gte: from,
            $lt: to
        }
    };
    const query: DocumentQuery<Array<IJobModel>, IJobModel> = Job.find(x);

    const results: Array<IJob> = await query.exec();

    return results;
};

/* ******************************************** */
/*                  STATISTICS                  */
/* ******************************************** */
/**
 * Return the count of a query.
 * @param {StatQueryParameter} queryParameters - Query parameters.
 */
const count = (queryParameters: StatQueryParameter): Promise<number> => {
    const query = Job.find(queryParameters);

    return query
        .count()
        .exec();
};

/**
 * Get the number of jobs with a status.
 * @param {JobStatus} status - Job status.
 * @param {StatOptions} options - Query options.
 */
export const getStatusCount = async (status: JobStatus, options?: StatOptions): Promise<number> => {
    validateConnection();

    const queryParameters: StatQueryParameter = { status };

    if (options && options.since) {
        queryParameters[options.field] = { $gte: options.since };
    }

    const result: number = await Job.find(queryParameters)
        .count()
        .exec();

    return result;
};

/**
 * Get the number of jobs in the database.
 * @param {StatOptions} options - Query options.
 */
export const getCount = async (options?: StatOptions): Promise<number> => {
    validateConnection();

    const queryParameters: StatQueryParameter = {};

    if (options && options.since) {
        queryParameters.finished = { $gte: options.since };
    }

    const total: number = await count(queryParameters);

    return total;
};
