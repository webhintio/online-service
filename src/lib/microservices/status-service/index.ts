import { AzureFunction, Context } from '@azure/functions';

import * as statusManager from '../../common/status/status';
import * as logger from '../../utils/logging';

const moduleName = 'Status Service';

const run: AzureFunction = async (context: Context, timer: any): Promise<void> => {
    try {
        await statusManager.updateStatuses();
    } catch (err) {
        logger.error(err, moduleName);
    }
};

export default run;
