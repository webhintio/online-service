import * as mongoose from 'mongoose';
(mongoose.Promise as any) = global.Promise;
import * as mongoDBLock from 'mongodb-lock';
import { promisify } from 'util';
import * as tri from 'tri';
import * as uuid from 'uuid/v4';

import { IJob, Rule } from '../../types/job'; // eslint-disable-line no-unused-vars
import { Job } from './models/job';
import { JobStatus } from '../../enums/status'; // eslint-disable-line no-unused-vars
import { debug as d } from '../../utils/debug';

const debug: debug.IDebugger = d(__filename);
let db: mongoose.Connection;
const lockName = 'index';

/**
 * Create a lock object.
 * @param {string} url - Url to lock in the database.
 */
const createLock = (url: string) => {
    const lock = mongoDBLock(db.db, 'locks', url, { removeExpired: true });

    debug(`Creating lock object to url: ${url ? url : 'initial'}`);
    lock.acquireAsync = promisify(lock.acquire);
    lock.releaseAsync = promisify(lock.release);
    lock.ensureIndexesAsync = promisify(lock.ensureIndexes);

    return lock;
};

/**
 * Check if the database is connected.
 */
const validateConnection = () => {
    if (!db) {
        debug('Database not connected');
        throw new Error('Database not connected');
    }
};

/**
 * Release a lock.
 * @param dbLock - Lock object to release.
 */
export const unlock = async (dbLock) => {
    validateConnection();

    debug(`release lock for code ${dbLock.code}`);
    await dbLock.releaseAsync(dbLock.code);
};

/**
 * Create a connection to the database.
 * @param {string} connectionString Connection string to the database.
 */
export const connect = async (connectionString: string) => {
    try {
        db = await mongoose.connect(connectionString, { useMongoClient: true });
        debug('Connected to database');

        const indexLock = createLock(lockName);

        debug('Creating index in database');
        await indexLock.ensureIndexesAsync();

    } catch (err) {
        debug('Error connecting to the database');
        throw err;
    }
};

/**
 * Create a lock for an url.
 * @param {string} url - Url to lock in the database.
 */
export const lock = async (url: string) => {
    validateConnection();

    const dbLock = createLock(url);

    const getLock = async () => {
        const code = await dbLock.acquireAsync();

        if (!code) {
            throw new Error('Lock not acquired');
        }

        return code;
    };

    await tri(getLock, {
        delay: 500,
        maxAttempts: 10
    });

    return dbLock;
};

/**
 * Get all the jobs from the database for a given url.
 * @param {string} url - Url we want to look for.
 */
export const getJobsByUrl = async (url: string): Promise<Array<IJob>> => {
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
export const getJob = async (id: string): Promise<IJob> => {
    validateConnection();

    debug(`Getting job by id: ${id}`);
    const query = Job.findOne({ id });

    const job = await query.exec();

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
export const newJob = async (url: string, status: JobStatus, rules: Array<Rule>, config): Promise<IJob> => {
    validateConnection();

    debug(`Creating new job for url: ${url}`);

    const job = new Job({
        config,
        id: uuid(),
        queued: new Date(),
        rules,
        status,
        url
    });

    await job.save();

    debug(`job for url ${url} saved in database `);

    return job;
};
