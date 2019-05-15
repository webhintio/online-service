import { AzureFunction, Context } from '@azure/functions';

import * as syncService from '../src/lib/microservices/sync-service/sync-service';
import { IJob } from '../src/lib/types';

export const run: AzureFunction = async (context: Context, job: IJob): Promise<void> => {
    await syncService.run(job);
};
