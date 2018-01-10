import { Document, Model, model } from 'mongoose';
import { IJob } from '../../../types';
import { IMongooseDocumentCommon } from './mongoosecommon';
import { JobSchema } from '../schemas/job';

/*
 * IMongooseDocumentCommon is a temporal solution until:
 *   1. @types/mongoose support property `usePushEach` in schemas
 *   2. or mongoose use `usePushEach` by default.
 */
export interface IJobModel extends IJob, Document, IMongooseDocumentCommon {
    id?: string; // Fix an error in docker because id is defined in IJob and Document.
}

export const Job: Model<IJobModel> = model<IJobModel>('Job', JobSchema);
