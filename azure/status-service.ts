import { AzureFunction, Context } from '@azure/functions';

import * as statusService from '../src/lib/microservices/status-service/status-service';

export const run: AzureFunction = async (context: Context, timer: any): Promise<void> => {
    await statusService.run();
};
