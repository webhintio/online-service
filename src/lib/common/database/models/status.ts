import { Document, Model, model } from 'mongoose';
import { IStatus } from '../../../types';
import { StatusSchema } from '../schemas/status';

export interface IStatusModel extends IStatus, Document { }

export const Status: Model<IStatusModel> = model<IStatusModel>('Status', StatusSchema);
