import { DocumentQuery } from 'mongoose';

import { debug as d } from '../../../utils/debug';
import { IUser } from '../../../types';
import { IUserModel, User } from '../models/user';
import { validateConnection } from './common';


const debug: debug.IDebugger = d(__filename);
/**
 * Add a new user to the database.
 * @param {string} name - User name.
 */
export const add = async (name: string): Promise<IUser> => {
    validateConnection();

    debug(`Adding user: ${name}`);

    const user: IUserModel = new User({ name });

    await user.save();

    debug(`User: ${name} saved in database`);

    return user;
};

/**
 * Get all users in the database.
 */
export const getAll = async (): Promise<Array<IUser>> => {
    validateConnection();

    const query: DocumentQuery<Array<IUserModel>, IUserModel> = User.find({});
    const users: Array<IUser> = await query.exec();

    return users;
};

/**
 * Get an user from the database.
 * @param {string} name - User name.
 */
export const get = async (name: string): Promise<IUser> => {
    validateConnection();
    const query: DocumentQuery<IUserModel, IUserModel> = User.findOne({ name });
    const user: IUser = await query.exec();

    return user;
};

/**
 * Remove an user from the database.
 * @param {string} name - User name.
 */
export const remove = async (name: string) => {
    validateConnection();
    const query: DocumentQuery<IUserModel, IUserModel> = User.findOne({ name });

    await query.remove().exec();
};
