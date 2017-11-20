import * as uuid from 'uuid/v4';
import { promisify } from 'util';

import { IConfig } from 'sonarwhal/dist/src/lib/types';
import * as mongoose from 'mongoose';
(mongoose.Promise as any) = global.Promise;
import * as mongoDBLock from 'mongodb-lock';
import * as tri from 'tri';

import { JobStatus } from '../../enums/status';
import { Job, IJobModel } from './models/job';
import { ServiceConfig, IServiceConfigModel } from './models/serviceconfig';
import { User, IUserModel } from './models/user';
import { Status, IStatusModel } from './models/status';
import { IJob, IServiceConfig, IStatus, IUser, Rule, StatOptions, StatQueryParameter } from '../../types';
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

/* ******************************************** */
/*                     JOBS                     */
/* ******************************************** */
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
    validateConnection();

    job.markModified('rules');

    await job.save();
};

/**
 * Update a property in a job.
 * @param jobId - ID for the job to update
 * @param property - Property to update
 * @param value - New value for the property
 */
export const updateJobProperty = (jobId: string, property: string, value): Promise<IJob> => {
    validateConnection();

    return Job.findOneAndUpdate({ id: jobId }, { $set: { [property]: value } }).exec();
};

export const getJobsByDate = async (field: string, from: Date, to: Date): Promise<Array<IJob>> => {
    validateConnection();

    const x = {
        [field]: {
            $gte: from,
            $lt: to
        }
    };
    const query: mongoose.DocumentQuery<Array<IJobModel>, IJobModel> = Job.find(x);

    const results: Array<IJob> = await query.exec();

    return results;
};

/* ******************************************** */
/*                CONFIGURATIONS                */
/* ******************************************** */
/**
 * Create a new configuration in database.
 * @param {string} name - New configuration name.
 * @param {number} jobCacheTime - Cache time in seconds for jobs.
 * @param {number} jobRunTime - Time before throw a timeout for jobs.
 * @param {IConfig} options - Configuration data.
 */
export const newConfig = async (name: string, jobCacheTime: number, jobRunTime: number, options: Array<IConfig>): Promise<IServiceConfig> => {
    validateConnection();

    debug(`Creating config with name: ${name}`);

    const config: IServiceConfigModel = new ServiceConfig({
        active: false,
        jobCacheTime,
        jobRunTime,
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
 * Get a configuration from the database by name
 * @param {string} name - Configuration name
 */
export const getConfigurationByName = async (name: string): Promise<IServiceConfig> => {
    validateConnection();

    const query: mongoose.DocumentQuery<IServiceConfigModel, IServiceConfigModel> = ServiceConfig.findOne({ name });
    const config: IServiceConfig = await query.exec();

    return config;
};

/**
 * Remove configuration from database by name
 * @param {string} name - Configuration name
 */
export const removeConfiguration = async (name: string) => {
    validateConnection();

    const query: mongoose.DocumentQuery<IServiceConfigModel, IServiceConfigModel> = ServiceConfig.findOne({ name });

    await query.remove().exec();
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
 * Edit a configuration.
 * @param {string} oldName - Old configuration name.
 * @param {string} newName - New configuration name.
 * @param {number} jobCacheTime - Cache time in seconds for jobs.
 * @param {number} jobRunTime - Time before throw a timeout for jobs.
 * @param {IConfig} options - Configuration data.
 */
export const editConfiguration = async (oldName: string, newName: string, jobCacheTime: number, jobRunTime: number, configs?: Array<IConfig>): Promise<IServiceConfig> => {
    validateConnection();

    const query: mongoose.DocumentQuery<IServiceConfigModel, IServiceConfigModel> = ServiceConfig.findOne({ name: oldName });
    const config: IServiceConfigModel = await query.exec();

    config.name = newName;
    config.jobCacheTime = jobCacheTime;
    config.jobRunTime = jobRunTime;

    if (configs) {
        config.sonarConfigs = configs;
        config.markModified('sonarConfigs');
    }

    await config.save();

    return config;
};

/**
 * Add a new user to the database.
 * @param {string} name - User name.
 */
export const addUser = async (name: string): Promise<IUser> => {
    validateConnection();

    debug(`Adding user: ${name}`);

    const user: IUserModel = new User({ name });

    await user.save();

    debug(`User: ${name} saved in database`);

    return user;
};

/**
 * Get all users in the database.
 */
export const getUsers = async (): Promise<Array<IUser>> => {
    validateConnection();

    const query: mongoose.DocumentQuery<Array<IUserModel>, IUserModel> = User.find({});
    const users: Array<IUser> = await query.exec();

    return users;
};

/**
 * Get an user from the database.
 * @param {string} name - User name.
 */
export const getUserByName = async (name: string): Promise<IUser> => {
    validateConnection();
    const query: mongoose.DocumentQuery<IUserModel, IUserModel> = User.findOne({ name });
    const user: IUser = await query.exec();

    return user;
};

/**
 * Remove an user from the database.
 * @param {string} name - User name.
 */
export const removeUserByName = async (name: string) => {
    validateConnection();
    const query: mongoose.DocumentQuery<IUserModel, IUserModel> = User.findOne({ name });

    await query.remove().exec();
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
export const getJobsCount = async (options?: StatOptions): Promise<number> => {
    validateConnection();

    const queryParameters: StatQueryParameter = {};

    if (options && options.since) {
        queryParameters.finished = { $gte: options.since };
    }

    const total: number = await count(queryParameters);

    return total;
};

/* ******************************************** */
/*                    STATUS                    */
/* ******************************************** */

/**
 * Add a new status in the database.
 * @param {IStatus} status - Status to save in database.
 */
export const addStatus = async (status: IStatus): Promise<IStatusModel> => {
    validateConnection();

    const newStatus = new Status(status);

    await newStatus.save();

    debug(`status created in database with date ${status.date.toISOString()}`);

    return newStatus;
};

/** Update an status in the database. */
export const updateStatus = async (status: IStatusModel, field) => {
    validateConnection();

    status.markModified(field);

    await status.save();
};

/**
 * Get the last status in the database
 */
export const getMostRecentStatus = async (): Promise<IStatus> => {
    validateConnection();

    const result: IStatus = await Status.findOne()
        .sort({ date: -1 })
        .exec();

    return result;
};

/**
 * Get the statuses between two dates.
 * @param {Date} from - Initial date.
 * @param {Date} to - End date.
 */
export const getStatusesByDate = async (from: Date, to: Date): Promise<Array<IStatus>> => {
    validateConnection();

    const result: Array<IStatus> = await Status.find({
        date: {
            $gte: from,
            $lte: to
        }
    }).exec();

    return result;
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
