import * as database from '../../common/database/database';
import { IUser } from '../../types';

/**
 * Get all users from the database.
 */
export const list = (): Promise<Array<IUser>> => {
    return database.user.getAll();
};

/**
 * Add an user to the database.
 * @param {string} name - User name.
 */
export const add = (name: string): Promise<IUser> => {
    if (!name) {
        throw new Error('Name empty');
    }

    return database.user.add(name);
};

/**
 * Remove an user from the database.
 * @param {string} name - User name.
 */
export const remove = async (name: string) => {
    if (!name) {
        throw new Error('Name empty');
    }

    const user = await database.user.get(name);

    if (!user) {
        throw new Error(`User ${name} doesn't exists`);
    }

    return database.user.remove(name);
};
