import { Document, Model, model } from 'mongoose';
import { IUser } from '../../../types';
import { UserSchema } from '../schemas/user';

export interface IUserModel extends IUser, Document {
}

export const User: Model<IUserModel> = model<IUserModel>('User', UserSchema);
