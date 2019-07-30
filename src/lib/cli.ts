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
import { CLIOptions } from './types';
import * as logger from './utils/logging';
import { loadJSONFile } from './utils/misc';
import * as worker from './microservices/worker-service/worker-service';

const pkg = loadJSONFile(path.join(__dirname, '../../../package.json'));
const moduleName: string = 'cli';
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
        const microservices = [];
        const microservice = currentOptions.microservice;

        if (microservice === Microservice.worker || microservice === Microservice.all) {
            microservices.push(worker.run());
        }

        await Promise.all(microservices);

        return 0;
    } catch (err) {
        logger.error(err, moduleName);

        return 1;
    }
};
