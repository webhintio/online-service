/**
 * @fileoverview Options configuration for optionator.
 */

/*
 * ------------------------------------------------------------------------------
 * Requirements
 * ------------------------------------------------------------------------------
 */

import * as optionator from 'optionator';

/*
 * ------------------------------------------------------------------------------
 * Initialization and Public Interface
 * ------------------------------------------------------------------------------
 */

export const options = optionator({
    defaults: {
        concatRepeatedArrays: true,
        mergeRepeatedObjects: true
    },
    mutuallyExclusive: ['server', 'file', 'activate', 'list', 'help'],
    options: [
        { heading: 'Basic configuration' },
        {
            alias: 'm',
            description: 'Microservice to run',
            enum: ['worker', 'all'],
            option: 'microservice',
            type: 'String'
        }, {
            alias: 'v',
            description: 'Output the version number',
            option: 'version',
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
    prepend: 'online-service --microservice server|config-manager|sync|worker [options]'
});
