import * as statusManager from '../../common/status/status';
import * as db from '../../common/database/database';
import * as logger from '../../utils/logging';
import { setTimeout } from 'timers';

const moduleName = 'Status Service';
const { database: dbConnectionString } = process.env; // eslint-disable-line no-process-env
const updateTimeout = 15 * 60 * 1000; // 15 minutes.

const updateStatuses = async () => {
    try {
        await statusManager.updateStatuses();
    } catch (err) {
        logger.error(err, moduleName);
    }
    setTimeout(updateStatuses, updateTimeout);
};

/** Initilize the server. */
export const run = async () => {
    await db.connect(dbConnectionString);

    updateStatuses();
};

if (process.argv[1].includes('status-service.js')) {
    run();
}
