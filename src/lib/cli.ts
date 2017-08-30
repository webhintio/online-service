/**
 * @fileoverview Main CLI object, it reads the configuration from parameters and 
 * run the microservice choosen or all of them
 */


// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------
import * as path from 'path';

import { options } from './cli/options';
import { Microservice } from './enums/microservice';
import { CLIOptions } from './types/clioptions'; // eslint-disable-line no-unused-vars
import * as logger from './utils/logging';
import { loadJSONFile } from './utils/misc';
import * as jobManagerServer from './microservices/job-manager/job-manager-server';

const pkg = loadJSONFile(path.join(__dirname, '../../../package.json'));

// ------------------------------------------------------------------------------
// Public
// ------------------------------------------------------------------------------

/** Executes the CLI based on an array of arguments that is passed in. */
export const execute = (args: string | Array<string> | object) => {
    const currentOptions: CLIOptions = options.parse(args);

    if (currentOptions.version) {
        logger.log(`v${pkg.version}`);

        return 0;
    }

    if (!currentOptions.microservice || currentOptions.help) {
        logger.log(options.generateHelp());

        return 0;
    }

    if (currentOptions.microservice === Microservice.jobManager) {
        jobManagerServer.init();
    }

    return 0;
};
