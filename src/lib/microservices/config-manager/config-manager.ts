import * as path from 'path';

import { IConfig } from 'sonarwhal/dist/src/lib/types';

import * as database from '../../common/database/database';
import { IServiceConfig, ConfigData } from '../../types';
import { loadJSONFile, validateServiceConfig } from '../../utils/misc';

/**
 * Get the configuration from a path.
 * @param {string} filePath - Configuration file path.
 */
const getConfigsFromFile = (filePath: string): Array<IConfig> => {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    const configs: Array<IConfig> = loadJSONFile(resolvedPath);

    if (!Array.isArray(configs)) {
        throw new Error('Configuration file has to contain an array of sonar configurations');
    }

    validateServiceConfig(configs);

    return configs;
};

/**
 * Validate if the data to create a new configuration is valid or not.
 * @param {ConfigData} configData Configuration data
 */
const validateConfigData = (configData: ConfigData, options?) => {
    const ignoreFilePath = options ? options.ignoreFilePath : false;

    if (!configData.name) {
        throw new Error(`Field name can't be empty`);
    }

    if (!configData.jobCacheTime) {
        throw new Error(`Field jobCacheTime can't be empty`);
    }

    if (!configData.jobRunTime) {
        throw new Error(`Field jobRunTime can't be empty`);
    }

    if (!ignoreFilePath && !configData.filePath) {
        throw new Error(`Field filePath can't be empty`);
    }
};

/**
 * Create a new configuration in database.
 * @param {string} name - Configuration name.
 * @param {number} cache - Cache time for jobs.
 * @param {string} filePath - Configuration file path.
 */
export const add = (configData: ConfigData): Promise<IServiceConfig> => {
    validateConfigData(configData);
    const newConfigs: Array<IConfig> = getConfigsFromFile(configData.filePath);

    return database.serviceConfig.add(configData.name, configData.jobCacheTime, configData.jobRunTime, newConfigs);
};

/**
 * Set a configuration as active.
 * @param {string} name Configuration name.
 */
export const activate = (name: string): Promise<IServiceConfig> => {
    return database.serviceConfig.activate(name);
};

/**
 * Get a list of all the configurations in the database.
 */
export const list = (): Promise<Array<IServiceConfig>> => {
    return database.serviceConfig.getAll();
};

/**
 * Delete a configuration from the database
 * @param {string} name - Configuration name.
 */
export const remove = async (name: string) => {
    const config = await database.serviceConfig.get(name);

    if (config.active) {
        throw new Error('Configuration is already active');
    }

    await database.serviceConfig.remove(name);
};

/**
 * Get the current active configuration.
 */
export const active = async (): Promise<IServiceConfig> => {
    const currentConfig: IServiceConfig = await database.serviceConfig.getActive();

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

/**
 * Get a configuration by name.
 * @param {string} name Configuration name.
 */
export const get = async (name: string): Promise<IServiceConfig> => {
    const config: IServiceConfig = await database.serviceConfig.get(name);

    if (!config) {
        throw new Error(`The configuration ${name} doesn't exist`);
    }

    return config;
};

/**
 * Edit a configuration.
 * @param {string} oldName Old configuration name.
 * @param {ConfigData} configData New configuration values.
 */
export const edit = async (oldName: string, configData: ConfigData): Promise<IServiceConfig> => {
    const config: IServiceConfig = await database.serviceConfig.get(oldName);

    if (!config) {
        throw new Error(`The configuration ${oldName} doesn't exist`);
    }

    validateConfigData(configData, { ignoreFilePath: true });

    const newConfigs: Array<IConfig> = configData.filePath ? getConfigsFromFile(configData.filePath) : null;

    return await database.serviceConfig.edit(oldName, configData.name, configData.jobCacheTime, configData.jobRunTime, newConfigs);
};
