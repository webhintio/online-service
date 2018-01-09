import { Document, Model, model } from 'mongoose';
import { IUser } from '../../../types';
import { UserSchema } from '../schemas/user';
import { IMongooseDocumentCommon } from './mongoosecommon';

/*
 * IMongooseCommon is a temporal solution until:
 *   1. @types/mongoose support property `usePushEach` in schemas
 *   2. or mongoose use `usePushEach` by default.
 */
export interface IUserModel extends IUser, Document, IMongooseDocumentCommon { }

export const User: Model<IUserModel> = model<IUserModel>('User', UserSchema);
