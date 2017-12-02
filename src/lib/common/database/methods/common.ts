import { promisify } from 'util';

import * as mongoDBLock from 'mongodb-lock';
import * as mongoose from 'mongoose';
import * as tri from 'tri';

(mongoose.Promise as any) = global.Promise;

import { debug as d } from '../../../utils/debug';
import * as logger from '../../../utils/logging';

const debug: debug.IDebugger = d(__filename);
let db: mongoose.Connection;
const lockName: string = 'index';
const moduleName: string = 'Database:common';

/**
 * Create a lock object.
 * @param {string} url - Url to lock in the database.
 */
export const createLock = (url: string) => {
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
export const validateConnection = () => {
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
