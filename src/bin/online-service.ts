#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the online-service command. Based on ESLint.
 */

/* eslint no-console:off */

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

const debug = (process.argv.includes('--debug'));

import * as d from 'debug';

// This initialization needs to be done *before* other requires in order to work.
if (debug) {
    d.enable('online-service:*');
}

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

// Now we can safely include the other modules that use debug.
import * as cli from '../lib/cli';

// ------------------------------------------------------------------------------
// Execution
// ------------------------------------------------------------------------------

process.once('uncaughtException', (err) => {
    console.error(err.message);
    console.error(err.stack);
    process.exitCode = 1;
});

process.once('unhandledRejection', (reason) => {
    console.error(reason);
    process.exitCode = 1;
});

const run = async () => {
    process.exitCode = await cli.execute(process.argv);
};

run();
