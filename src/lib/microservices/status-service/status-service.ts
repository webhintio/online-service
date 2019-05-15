import * as statusManager from '../../common/status/status';
import * as logger from '../../utils/logging';

const moduleName = 'Status Service';

export const run = async (): Promise<void> => {
    try {
        await statusManager.updateStatuses();
    } catch (err) {
        logger.error(err, moduleName);
    }
};
