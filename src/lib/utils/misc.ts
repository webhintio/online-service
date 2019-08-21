import * as fs from 'fs';
import { promisify } from 'util';

import stripBom = require('strip-bom');
import * as stripComments from 'strip-json-comments';
import { validateConfig } from 'hint/dist/src/lib/config/config-validator';
import { UserConfig, normalizeHints } from '@hint/utils';

import { debug as d } from './debug';
import { JobStatus } from '../enums/status';
import { IJob } from '../types';

const debug: debug.IDebugger = d(__filename);
const _readFileAsync = promisify(fs.readFile);

/* istanbul ignore next */
/** Convenience wrapper for asynchronously reading file contents. */
export const readFileAsync = async (filePath: string): Promise<string> => {
    const content: string = await _readFileAsync(filePath, 'utf8');

    return stripBom(content);
};

/* istanbul ignore next */
/** Convenience wrapper for synchronously reading file contents. */
export const readFile = (filePath: string): string => {
    return stripBom(fs.readFileSync(filePath, 'utf8')); // eslint-disable-line no-sync
};

/* istanbul ignore next */
/** Loads a JSON a file. */
export const loadJSONFile = (filePath: string) => {
    debug(`Loading JSON file: ${filePath}`);

    return JSON.parse(stripComments(readFile(filePath)));
};

/* istanbul ignore next */
/** Convenience wrapper to add a delay using promises. */
export const delay = (millisecs: number): Promise<object> => {
    return new Promise((resolve) => {
        setTimeout(resolve, millisecs);
    });
};

/**
 * Check if an array of webhint configurations is valid.
 * @param {Array<UserConfig>} configs - Array of webhint configurations.
 */
export const validateServiceConfig = (configs: Array<UserConfig>) => {
    const hints: Set<string> = new Set();

    for (const config of configs) {
        if (!validateConfig(config)) {
            throw new Error(`Invalid Configuration
${JSON.stringify(config)}`);
        }

        const normalizedHints = normalizeHints(config.hints);

        for (const [key] of Object.entries(normalizedHints)) {
            if (hints.has(key)) {
                throw new Error(`Hint ${key} repeated`);
            }

            hints.add(key);
        }
    }
};

/**
 * Generate a log message for a job.
 * @param {string} header - Log header.
 * @param {IJob} job - Job to get the log info
 */
export const generateLog = (header: string, job: IJob, options: { showHint: boolean } = { showHint: false }) => {
    const showHint = options.showHint && job.status !== JobStatus.started;

    let log = `${header}:
    - Id: ${job.id}
    - Part: ${job.partInfo.part} of ${job.partInfo.totalParts}
    - Status: ${job.status}`;

    if (showHint) {
        job.hints.forEach((hint) => {
            log += `
    - Hint: ${hint.name}`;
        });
    }

    return log;
};
