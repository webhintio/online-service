import { Document, Model, model } from 'mongoose'; // eslint-disable-line no-unused-vars
import { IJob } from '../../../types/job';
import { JobSchema } from '../schemas/job';

export interface IJobModel extends IJob, Document {
}

export const Job: Model<IJobModel> = model<IJobModel>('Job', JobSchema);
