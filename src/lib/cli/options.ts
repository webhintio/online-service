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
        }, {
            alias: 'h',
            description: 'Show help',
            option: 'help',
            type: 'Boolean'
        }
    ],
    prepend: 'online-service --microservice job-manager|config-manager|sync|worker|all'
});
