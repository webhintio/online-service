import * as config from '@sonarwhal/sonar/dist/src/lib/config';
import { validateConfig } from '@sonarwhal/sonar/dist/src/lib/config/config-validator';
import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';

import * as database from '../../common/database/database';
import { IServiceConfig } from '../../types';

/**
 * Get the configuration from a path.
 * @param {string} filePath - Configuration file path.
 */
const getConfigFromFile = (filePath: string): IConfig => {
    const configFromFile: IConfig = config.load(filePath);

    if (!validateConfig(configFromFile)) {
        throw new Error('Invalid Configuration file');
    }

    return configFromFile;
};

/**
 * Create a new configuration in database.
 * @param {string} name - Configuration name.
 * @param {number} cache - Cache time for jobs.
 * @param {string} filePath - Configuration file path.
 */
export const createNewConfiguration = (name: string, cache: number, run: number, filePath: string): Promise<IServiceConfig> => {
    const newConfig = getConfigFromFile(filePath);

    return database.newConfig(name, cache, run, newConfig);
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
        sonarConfig: currentConfig.sonarConfig
    };

    return result;
};
