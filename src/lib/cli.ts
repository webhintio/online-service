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
import * as configManagerServer from './microservices/config-manager/config-manager-server';
import * as configManagerCLI from './microservices/config-manager/config-manager-cli';
import * as jobManagerServer from './microservices/job-manager/job-manager-server';
import { CLIOptions } from './types';
import * as logger from './utils/logging';
import { loadJSONFile } from './utils/misc';
import * as worker from './microservices/worker-service/worker-service';
import * as sync from './microservices/sync-service/sync-service';

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

        if (microservice === Microservice.jobManager || microservice === Microservice.all) {
            microservices.push(jobManagerServer.run());
        }
        if (microservice === Microservice.configManager) {
            microservices.push(configManagerCLI.run(currentOptions));
        }
        if ((microservice === Microservice.configManager && currentOptions.server) || microservice === Microservice.all) {
            microservices.push(configManagerServer.run());
        }
        if (microservice === Microservice.worker || microservice === Microservice.all) {
            microservices.push(worker.run());
        }
        if (microservice === Microservice.sync || microservice === Microservice.all) {
            microservices.push(sync.run());
        }

        await Promise.all(microservices);

        return 0;
    } catch (err) {
        logger.error(err, moduleName);

        return 1;
    } finally {
        database.disconnect();
    }
};
