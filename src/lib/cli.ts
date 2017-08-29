/**
 * @fileoverview Main CLI object, it reads the configuration from parameters and 
 * run the microservice choosen or all of them
 */


// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------
import * as path from 'path';

import { options } from './cli/options';
import * as database from './common/database/database';
import { Microservice } from './enums/microservice';
import * as configManagerCLI from './microservices/config-manager/config-manager-cli';
import * as jobManagerServer from './microservices/job-manager/job-manager-server';
import { CLIOptions } from './types/clioptions'; // eslint-disable-line no-unused-vars
import * as logger from './utils/logging';
import { loadJSONFile } from './utils/misc';

const pkg = loadJSONFile(path.join(__dirname, '../../../package.json'));

// ------------------------------------------------------------------------------
// Public
// ------------------------------------------------------------------------------

/** Executes the CLI based on an array of arguments that is passed in. */
export const execute = async (args: string | Array<string> | object): Promise<number> => {
    const currentOptions: CLIOptions = options.parse(args);

    if (currentOptions.version) {
        logger.log(`v${pkg.version}`);

        return 0;
    }

    if (!currentOptions.microservice || currentOptions.help) {
        logger.log(options.generateHelp());

        return 0;
    }

    try {
        if (currentOptions.microservice === Microservice.jobManager) {
            await jobManagerServer.init();
        } else if (currentOptions.microservice === Microservice.configManager) {
            await configManagerCLI.run(currentOptions);
        }

        return 0;
    } catch (err) {
        logger.error(err);

        return 1;
    } finally {
        database.disconnect();
    }
};
