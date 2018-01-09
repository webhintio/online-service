import { Document, Model, model } from 'mongoose';
import { ServiceConfigSchema } from '../schemas/serviceconfig';
import { IServiceConfig } from '../../../types';
import { IMongooseDocumentCommon } from './mongoosecommon';

/*
 * IMongooseCommon is a temporal solution until:
 *   1. @types/mongoose support property `usePushEach` in schemas
 *   2. or mongoose use `usePushEach` by default.
 */
export interface IServiceConfigModel extends IServiceConfig, Document, IMongooseDocumentCommon { }

export const ServiceConfig: Model<IServiceConfigModel> = model<IServiceConfigModel>('ServiceConfig', ServiceConfigSchema);
