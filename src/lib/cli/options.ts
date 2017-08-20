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
        {heading: 'Basic configuration'},
        {
            alias: 'k',
            description: 'Key file for certificate',
            option: 'key',
            type: 'path::String'
        },
        {
            alias: 'c',
            description: 'Certificate file',
            option: 'cert',
            type: 'path::String'
        },
        {
            alias: 'p',
            description: 'PFX file',
            option: 'pfx',
            type: 'path::String'
        },
        {
            alias: 'pp',
            description: 'Passphrase for PFX file',
            option: 'pass',
            type: 'String'
        },
        {
            alias: 'ms',
            description: 'Microservice to run',
            enum: ['job-manager', 'config-manager', 'sync', 'worker'],
            option: 'microservice',
            type: 'String'
        }
    ],
    prepend: 'online-service --microservice job-manager|config-manager|sync|worker [options]'
});
