import { Document, Model, model } from 'mongoose';
import { IStatus } from '../../../types';
import { StatusSchema } from '../schemas/status';
import { IMongooseDocumentCommon } from './mongoosecommon';

/*
 * IMongooseCommon is a temporal solution until:
 *   1. @types/mongoose support property `usePushEach` in schemas
 *   2. or mongoose use `usePushEach` by default.
 */
export interface IStatusModel extends IStatus, Document, IMongooseDocumentCommon { }

export const Status: Model<IStatusModel> = model<IStatusModel>('Status', StatusSchema);
