import { AzureFunction, Context } from '@azure/functions';

import * as statusManager from '../../common/status/status';
import * as db from '../../common/database/database';
import * as logger from '../../utils/logging';

const moduleName = 'Status Service';
const { database: Database } = process.env; // eslint-disable-line no-process-env

const run: AzureFunction = async (context: Context, timer: any): Promise<void> => {
    try {
        await db.connect(Database);
        await statusManager.updateStatuses();
    } catch (err) {
        logger.error(err, moduleName);
    }
};

export default run;
