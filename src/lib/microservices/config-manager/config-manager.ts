import * as path from 'path';

import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';

import * as database from '../../common/database/database';
import { IServiceConfig } from '../../types';
import { loadJSONFile, validateServiceConfig } from '../../utils/misc';

/**
 * Get the configuration from a path.
 * @param {string} filePath - Configuration file path.
 */
const getConfigsFromFile = (filePath: string): Array<IConfig> => {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const configs: Array<IConfig> = loadJSONFile(resolvedPath);

    validateServiceConfig(configs);

    return configs;
};

/**
 * Create a new configuration in database.
 * @param {string} name - Configuration name.
 * @param {number} cache - Cache time for jobs.
 * @param {string} filePath - Configuration file path.
 */
export const createNewConfiguration = (name: string, cache: number, run: number, filePath: string): Promise<IServiceConfig> => {
    const newConfigs: Array<IConfig> = getConfigsFromFile(filePath);

    return database.newConfig(name, cache, run, newConfigs);
};

/**
 * Set a configuration as active.
 * @param {string} name Configuration name.
 */
export const activateConfiguration = (name: string): Promise<IServiceConfig> => {
    return database.activateConfiguration(name);
};

/**
 * Get a list of all the configurations in the database.
 */
export const listConfigurations = (): Promise<Array<IServiceConfig>> => {
    return database.listConfigurations();
};

/**
 * Get the current active configuration.
 */
export const getActiveConfiguration = async (): Promise<IServiceConfig> => {
    const currentConfig: IServiceConfig = await database.getActiveConfiguration();

    if (!currentConfig) {
        throw new Error('There is no active configuration');
    }

    const result: IServiceConfig = {
        active: currentConfig.active,
        jobCacheTime: currentConfig.jobCacheTime,
        jobRunTime: currentConfig.jobRunTime,
        name: currentConfig.name,
        sonarConfigs: currentConfig.sonarConfigs
    };

    return result;
};
