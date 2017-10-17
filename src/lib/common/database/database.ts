import * as uuid from 'uuid/v4';
import { promisify } from 'util';

import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';
import * as mongoose from 'mongoose';
(mongoose.Promise as any) = global.Promise;
import * as mongoDBLock from 'mongodb-lock';
import * as tri from 'tri';

import { JobStatus } from '../../enums/status';
import { Job, IJobModel } from './models/job';
import { ServiceConfig, IServiceConfigModel } from './models/serviceconfig';
import { IJob, IServiceConfig, Rule } from '../../types';
import { debug as d } from '../../utils/debug';
import * as logger from '../../utils/logging';

const debug: debug.IDebugger = d(__filename);
let db: mongoose.Connection;
const lockName: string = 'index';
const moduleName: string = 'Database';

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

    logger.log(`Release lock for key ${dbLock.name}`, moduleName);
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
            logger.error(`Lock not acquired for key ${url}`, moduleName);

            throw new Error('Lock not acquired');
        }

        logger.log(`Lock acquired for key ${url}`, moduleName);

        return code;
    };

    dbLock.code = await tri(getLock, {
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
export const getJob = async (id: string): Promise<IJobModel> => {
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
export const newJob = async (url: string, status: JobStatus, rules: Array<Rule>, config: Array<IConfig>, jobRunTime: number): Promise<IJob> => {
    validateConnection();

    debug(`Creating new job for url: ${url}`);

    const job = new Job({
        config,
        id: uuid(),
        maxRunTime: jobRunTime,
        queued: new Date(),
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
export const updateJob = async (job: IJobModel) => {
    job.markModified('rules');

    await job.save();
};

/**
 * Create a new configuration in database.
 * @param {string} name - New configuration name.
 * @param {number} cache - Cache time in seconds for jobs.
 * @param {IConfig} options - Configuration data.
 */
export const newConfig = async (name: string, cache: number, run: number, options: Array<IConfig>): Promise<IServiceConfig> => {
    validateConnection();

    debug(`Creating config with name: ${name}`);

    const config: IServiceConfigModel = new ServiceConfig({
        active: false,
        jobCacheTime: cache,
        jobRunTime: run,
        name,
        sonarConfigs: options
    });

    await config.save();

    debug(`Config with name: ${name} saved in database`);

    return config;
};

/**
 * Mark a configuration as active.
 * @param {string} name - Name of the configuration to activate.
 */
export const activateConfiguration = async (name: string): Promise<IServiceConfig> => {
    validateConnection();

    debug(`Getting config by name: ${name}`);
    const query: mongoose.DocumentQuery<Array<IServiceConfigModel>, IServiceConfigModel> = ServiceConfig.find({});
    const configs: Array<IServiceConfigModel> = await query.exec();

    // First we will check if the config exists or not
    const configuration = configs.find((config) => {
        return config.name === name;
    });

    if (!configuration) {
        throw new Error(`Configuration '${name}' doesn't exist`);
    }

    for (const config of configs) {
        if (config && config.name !== name) {
            config.active = false;

            await config.save();

            debug(`Configuration ${config.name} is not the default`);
        }
    }

    configuration.active = true;

    await configuration.save();

    debug(`Configuration ${configuration.name} is the new default configuration`);

    return configuration;
};

/**
 * Get all the configurations stored in database.
 */
export const listConfigurations = async (): Promise<Array<IServiceConfig>> => {
    validateConnection();

    const query: mongoose.DocumentQuery<Array<IServiceConfigModel>, IServiceConfigModel> = ServiceConfig.find({});
    const configs: Array<IServiceConfig> = await query.exec();

    return configs;
};

/**
 * Get the current active configuration.
 */
export const getActiveConfiguration = async (): Promise<IServiceConfig> => {
    validateConnection();

    const query: mongoose.DocumentQuery<IServiceConfigModel, IServiceConfigModel> = ServiceConfig.findOne({ active: true });
    const config: IServiceConfig = await query.exec();

    return config;
};

/**
 * Disconnect from the database.
 */
export const disconnect = async () => {
    if (db) {
        try {
            await mongoose.disconnect();
        } catch (err) {
            // Do nothing.
        } finally {
            db = null;
        }
    }
};
