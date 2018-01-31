import { spawn } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import * as globby from 'globby';
import * as moment from 'moment';
import * as schedule from 'node-schedule';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';
import * as tar from 'tar';

import * as db from '../../common/database/database';
import * as logger from '../../utils/logging';
import * as storage from '../../common/storage/storage';
import { Email } from '../../common/email/email';

const rimrafAsync = promisify(rimraf);

const { database, adminUser, adminPassword, authDatabase } = process.env; // eslint-disable-line no-process-env
const moduleName: string = 'Backup service';
const maxWeeklyCopies: number = 4;
const maxDailyCopies: number = 7;
const email = new Email();
let backupJob;
let weeklyJob;
let monthlyJob;

const sendEmail = (text: string, subject: string) => {
    return email.send(subject, `${text}\n\n`);
};

/**
 * Connect to the database.
 */
const connectToDatabase = () => {
    return db.connect(database);
};

/**
 * Calculate the host for `mongodump`.
 * @param {string} replicaStatus - Database replica information.
 */
const getHosts = (replicaStatus) => {
    if (!replicaStatus) {
        return db.host();
    }

    const hosts = replicaStatus.members.map((member) => {
        return member.name;
    });

    return `${replicaStatus.set}/${hosts.join(',')}`;
};

/**
 * Create a database backup using `mongodump`.
 * @param {string} outPath - Path to write the backup.
 */
const createBackup = async (outPath: string) => {
    const replicaStatus = await db.replicaSetStatus();
    const hosts = await getHosts(replicaStatus);
    const isSSL = database.match(/ssl=true/g);

    /*
     * For more information related to this command, please visit:
     * https://docs.mongodb.com/manual/reference/program/mongodump/
     */
    const command = `mongodump --host ${hosts}${authDatabase ? ` --authenticationDatabase ${authDatabase}` : ''} --gzip ${replicaStatus ? '--oplog' : ''} ${isSSL ? '--ssl' : ''} --out ${outPath} --username ${adminUser} --password ${adminPassword}`;

    return new Promise((resolve, reject) => {
        const backup = spawn(command, [], { shell: true });

        backup.stdout.setEncoding('utf8');
        backup.stdout.on('data', (data) => {
            logger.log(`${data ? (data as string).trim() : ''}`);
        });

        backup.stderr.setEncoding('utf8');
        backup.stderr.on('data', (data) => {
            /*
             * mongodump messaging is done via standard error.
             * https://jira.mongodb.org/browse/TOOLS-1484
             */
            logger.log(`${data ? (data as string).trim() : ''}`);
        });

        backup.on('error', (err) => {
            reject(err);
        });

        backup.on('exit', (code) => {
            if (code !== 0) {
                return reject(`Error creating backup with code: ${code}`);
            }

            return resolve();
        });
    });
};

/**
 * Pack in a tar file and upload the backup to an azure storage account.
 * @param {storage.StorageContainer} container - Storage container to upload the backup.
 * @param {string} backupPath - Path to the backup files.
 */
const uploadBackup = async (container: storage.StorageContainer, backupPath: string): Promise<string> => {
    const date: string = backupPath.replace(path.join(backupPath, '..'), '').substring(1);
    const files: Array<string> = await globby('**/*.gz', { cwd: backupPath });
    const name: string = `${date}.tar`;
    const file: string = path.join(backupPath, name);

    await tar.c({ cwd: backupPath, file }, files);

    await container.uploadFile(name, file);

    return name;
};

/**
 * Remove files created for the backup.
 * @param {string} backupPath - Path to delete.
 */
const removeLocalFiles = (backupPath: string) => {
    return rimrafAsync(backupPath);
};

/**
 * Remove old backups from a container.
 * @param {storage.StorageContainer} container - Storage container to remove files.
 * @param {number} maxItems - Max number of items to keep in the storage container.
 */
const removeOldBackups = async (container: storage.StorageContainer, maxItems: number) => {
    const blobs = await container.getBlobs();

    if (blobs.length > maxItems) {
        logger.log(`There are a total of ${blobs.length} backups in container "${container.name}". Removing ${blobs.length - maxItems} of them.`, moduleName);

        const sortedBackups = _(blobs)
            .sortBy((blob) => {
                return blob.name.substring(0, blob.name.indexOf('.'));
            })
            .reverse()
            .value();

        for (let i = maxItems; i < sortedBackups.length; i++) {
            logger.log(`Removing blob ${sortedBackups[i].name} from container "${container.name}"`, moduleName);
            await container.deleteBlob(sortedBackups[i].name);
            logger.log(`Blob ${sortedBackups[i].name} removed from container "${container.name}"`, moduleName);
        }
    }
};

/**
 * Create a database backup.
 */
export const backup = async () => {
    try {
        const start = Date.now();

        logger.log('Connecting to database.', moduleName);

        await connectToDatabase();

        logger.log('Database connected.', moduleName);

        const outPath = path.join(__dirname, 'backup', moment().format('YYYY-MM-DD-HH-mm'));

        logger.log(`Baking db in ${outPath}.`, moduleName);

        await createBackup(outPath);
        logger.log(`Backup complete in ${((Date.now() - start) / 60000).toFixed(2)} minutes`, moduleName);

        logger.log(`Uploading backup from ${outPath}`, moduleName);

        const container = await storage.getContainer('backup');

        const backupName = await uploadBackup(container, outPath);

        await removeLocalFiles(outPath);

        await removeOldBackups(container, maxDailyCopies);

        logger.log('Upload backup completed.', moduleName);

        await sendEmail(`Backup "${backupName}" created at ${moment().toISOString()}`, 'Backup created');
    } catch (err) {
        logger.error('Error creating backup.', moduleName, err);
        await sendEmail(`Error creating backup:
${err.toString()}`, 'Error creating Backup');
    }

    if (backupJob) {
        logger.log(`Next backup will start at ${backupJob.nextInvocation().toISOString()}`, moduleName);
    }
};

/**
 * Copy the most recent backup from a container to another.
 * @param {storage.StorageContainer} originContainer - Container with the file we want to copy.
 * @param {storage.StorageContainer} targetContainer - Container where we want to copy the file.
 */
const copyMostRecentBlob = async (originContainer: storage.StorageContainer, targetContainer: storage.StorageContainer): Promise<string> => {
    const backups = await originContainer.getBlobs();
    const newestBackup = _(backups)
        .sortBy((blob) => {
            return blob.name.substring(0, blob.name.indexOf('.'));
        })
        .reverse()
        .first();

    const blobName: string = `${moment().format('YYYY-MM-DD-HH-mm')}.tar`;

    await originContainer.copyBlob(newestBackup.name, targetContainer, blobName);

    return blobName;
};

/**
 * Copy the most recent backup in the weekly backups container.
 */
export const weeklyBackup = async () => {
    try {
        const dailyContainer: storage.StorageContainer = await storage.getContainer('backup');
        const weeklyContainer: storage.StorageContainer = await storage.getContainer('backupweekly');

        const blobName = await copyMostRecentBlob(dailyContainer, weeklyContainer);

        logger.log(`Weekly copy completed with name: ${blobName}`, moduleName);

        await removeOldBackups(weeklyContainer, maxWeeklyCopies);

        logger.log('Weekly backup copy complete.', moduleName);

        await sendEmail(`Weekly backup "${blobName}" created at ${moment().toISOString()}`, 'Weekly backup completed.');
    } catch (err) {
        logger.error('Error copying weekly backup.', moduleName, err);
        await sendEmail(`Error creating weekly backup:
${err.toString()}`, 'Error creating weekly backup');
    }

    if (weeklyJob) {
        logger.log(`Next weekly copy will start at: ${weeklyJob.nextInvocation().toISOString()}`, moduleName);
    }
};

/**
 * Copy the most recent backup in the monthly backups container.
 */
export const monthlyBackup = async () => {
    try {
        const dailyContainer: storage.StorageContainer = await storage.getContainer('backup');
        const monthlyContainer: storage.StorageContainer = await storage.getContainer('backupmonthly');

        const blobName = await copyMostRecentBlob(dailyContainer, monthlyContainer);

        logger.log('Monthly backup copy complete.', moduleName);
        await sendEmail(`Monthly backup "${blobName}" created at ${moment().toISOString()}`, 'Montly backup completed.');
    } catch (err) {
        logger.error('Error copying monthly backup.', moduleName, err);
        await sendEmail(`Error creating monthly backup:
${err.toString()}`, 'Error creating monthly backup');
    }

    if (monthlyJob) {
        logger.log(`Next monthly copy will start at: ${monthlyJob.nextInvocation().toISOString()}`, moduleName);
    }
};

export const run = () => {
    // Run backup process.
    backupJob = schedule.scheduleJob('0 0 1 * * *', backup);

    // Store weekly backup (Every Sunday at 3AM)
    weeklyJob = schedule.scheduleJob('0 0 3 * * 0', weeklyBackup);

    // Store monthly backup (Every 1st of each month at 4AM)
    monthlyJob = schedule.scheduleJob('0 0 4 1 * *', monthlyBackup);

    logger.log(`Backup Job will start at: ${backupJob.nextInvocation().toISOString()}`, moduleName);
    logger.log(`Weekly copy Job will start at: ${weeklyJob.nextInvocation().toISOString()}`, moduleName);
    logger.log(`Monthly copy Job will start at: ${monthlyJob.nextInvocation().toISOString()}`, moduleName);
};

if (process.argv[1].includes('db-backup.js')) {
    run();
}
