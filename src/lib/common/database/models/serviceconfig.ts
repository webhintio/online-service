import { Document, Model, model } from 'mongoose'; // eslint-disable-line no-unused-vars
import { ServiceConfigSchema } from '../schemas/serviceconfig';
import { IServiceConfig } from '../../../types';

export interface IServiceConfigModel extends IServiceConfig, Document {
}

export const ServiceConfig: Model<IServiceConfigModel> = model<IServiceConfigModel>('ServiceConfig', ServiceConfigSchema);
