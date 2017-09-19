import { IConnectorConfig, IRuleConfigList, RuleConfig, IConfig } from '@sonarwhal/sonar/dist/src/lib/types';

import { options } from '../../cli/options';
import * as database from '../../common/database/database';
import * as configManager from './config-manager';
import { CLIOptions, IServiceConfig } from '../../types';
import * as logger from '../../utils/logging';

/**
 * Print the connector options.
 * @param {IConfig} config Sonar configuration.
 */
const printConnectorOptions = (config: IConfig) => {
    const connectorOptions = (config.connector as IConnectorConfig).options;

    if (connectorOptions) {
        logger.log('Options: ');
        for (const [key, value] of Object.entries(connectorOptions)) {
            logger.log(`    ${key}: ${value}`);
        }
    }
};

/**
 * Print rules in the configuration.
 * @param {IRuleConfigList | Array<RuleConfig>} rules Rules to print.
 */
const printRules = (rules: IRuleConfigList | Array<RuleConfig>) => {
    logger.log(JSON.stringify(rules, null, 4));
};

/**
 * Print the configuration options.
 * @param {IConfig} config Sonar configuration.
 */
const printOptions = (config: IConfig) => {
    if (config.browserslist) {
        logger.log(`browserslist: ${config.browserslist}`);
    }
    if (typeof config.rulesTimeout !== 'undefined') {
        logger.log(`rulesTimeout: ${config.rulesTimeout}`);
    }
    if (config.ignoredUrls) {
        logger.log(`ignoredUrls:`);
        for (const [key, value] of Object.entries(config.ignoredUrls)) {
            logger.log(`    ${key}: ${value}`);
        }
    }
};

/**
 * Execute the function indicated in the options.
 * @param {CLIOptions} cliOptions Options from the CLI.
 */
export const run = async (cliOptions: CLIOptions) => {
    await database.connect(process.env.database); // eslint-disable-line no-process-env

    if (cliOptions.file) {
        try {
            const newConfig: IServiceConfig = await configManager.createNewConfiguration(cliOptions.name, cliOptions.cache, cliOptions.run, cliOptions.file);

            logger.log(`Configuration '${newConfig.name}' created.`);

            return 0;
        } catch (err) {
            if (err.code === 11000) {
                logger.error(`Already exists a configuration with name '${cliOptions.name}'`, err);
            } else {
                logger.error(err.message, err);
            }

            return 1;
        }
    }

    if (cliOptions.activate) {
        const config: IServiceConfig = await configManager.activateConfiguration(cliOptions.name);

        logger.log(`Configuration '${config.name}' activated.`);

        return 0;
    }

    if (cliOptions.list) {
        const configurations: Array<IServiceConfig> = await configManager.listConfigurations();

        if (configurations.length === 0) {
            logger.log('There is no configuration stored in database');

            return null;
        }

        for (const serviceConfig of configurations) {
            logger.log(`Configuration name: ${serviceConfig.name}${serviceConfig.active ? ' (Active)' : ''}`);
            logger.log(`Cache for jobs: ${serviceConfig.jobCacheTime} seconds`);
            logger.log(`Time to run sonar: ${serviceConfig.jobRunTime} seconds`);
            logger.log('===================================');
            logger.log('======= Sonar configuration =======');
            logger.log('===================================');
            const configs = serviceConfig.sonarConfigs;

            for (const config of configs) {
                logger.log('============ Connector ============');
                logger.log(`Name: ${typeof config.connector === 'string' ? config.connector : config.connector.name}`);
                printConnectorOptions(config);
                logger.log('============== Rules ==============');
                printRules(config.rules);
                if (config.plugins) {
                    logger.log('============= Plugins =============');
                    printRules(config.plugins);
                }
                logger.log('============= Options =============');
                printOptions(config);
                logger.log('');
                logger.log('');
            }
        }

        return null;
    }

    logger.log('Configuration manager options:\n');
    logger.log(`${options.generateHelpForOption('list')}\n`);
    logger.log(`${options.generateHelpForOption('file')}\n`);
    logger.log(`${options.generateHelpForOption('activate')}\n`);

    return 0;
};
