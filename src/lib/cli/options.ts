/**
 * @fileoverview Options configuration for optionator.
 */

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

import * as optionator from 'optionator';

// ------------------------------------------------------------------------------
// Initialization and Public Interface
// ------------------------------------------------------------------------------

export const options = optionator({
    defaults: {
        concatRepeatedArrays: true,
        mergeRepeatedObjects: true
    },
    mutuallyExclusive: ['file', 'activate', 'list', 'help'],
    options: [
        { heading: 'Basic configuration' },
        {
            alias: 'm',
            description: 'Microservice to run',
            enum: ['job-manager', 'config-manager', 'sync', 'worker', 'all'],
            option: 'microservice',
            type: 'String'
        }, {
            alias: 'v',
            description: 'Output the version number',
            option: 'version',
            type: 'Boolean'
        },
        { heading: 'Config Manager options' },
        {
            alias: 'n',
            description: 'Name for the configuration',
            option: 'name',
            type: 'String'
        }, {
            alias: 'c',
            description: 'Cache time in seconds for jobs',
            option: 'cache',
            type: 'Int'
        }, {
            alias: 'r',
            description: 'Time in seconds a job has to complete the execution in sonar',
            option: 'run',
            type: 'Int'
        }, {
            alias: 'f',
            dependsOn: ['and', 'name', 'cache', 'run'],
            description: 'Path to a file with an array of sonar configurations to store in database',
            example: 'online-service --microservice config-manager --name new-config-name --file config-file.json --cache 120 --run 120',
            option: 'file',
            type: 'path::String'
        }, {
            alias: 'a',
            dependsOn: 'name',
            description: 'Activate a configuration by name',
            example: 'online-service --microservice config-manager --activate --name config-name',
            option: 'activate',
            type: 'Boolean'
        }, {
            alias: 'l',
            description: 'List all the configuration available',
            example: 'online-service --microservice config-manager --list',
            option: 'list',
            type: 'Boolean'
        },
        {heading: 'Miscellaneous'},
        {
            default: false,
            description: 'Output debugging information',
            option: 'debug',
            type: 'Boolean'
        },
        {
            alias: 'h',
            description: 'Show help',
            option: 'help',
            type: 'Boolean'
        }
    ],
    prepend: 'online-service --microservice job-manager|config-manager|sync|worker|all [options]'
});
