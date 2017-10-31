import { Document, Model, model } from 'mongoose';
import { IJob } from '../../../types';
import { JobSchema } from '../schemas/job';

export interface IJobModel extends IJob, Document { }

export const Job: Model<IJobModel> = model<IJobModel>('Job', JobSchema);
