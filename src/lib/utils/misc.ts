import * as fs from 'fs';
import { promisify } from 'util';

import { Request } from 'express';
import * as multiparty from 'multiparty';
import * as stripBom from 'strip-bom';
import * as stripComments from 'strip-json-comments';
import { validateConfig } from '@sonarwhal/sonar/dist/src/lib/config/config-validator';
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';
import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';

import { debug as d } from './debug';
import { ConfigSource } from '../enums/configsource';
import { RequestData } from '../types';

const debug: debug.IDebugger = d(__filename);
const _readFileAsync = promisify(fs.readFile);

/** Max size for uploaded files. */
const maxFilesSize = 1024 * 100; // 100KB.
// This limit avoid people to upload very big files from the scanner. It is expected
// that users just upload a sonar configuration files so 100KB is more than
// enough.

/** Convenience wrapper for asynchronously reading file contents. */
export const readFileAsync = async (filePath: string): Promise<string> => {
    const content: string = await _readFileAsync(filePath, 'utf8');

    return stripBom(content);
};

/** Read multipart data from request. */
export const getDataFromRequest = (req: Request): Promise<RequestData> => {
    return new Promise((resolve, reject) => {
        const form = new multiparty.Form({ maxFilesSize });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return reject(err);
            }

            // TODO: check if it is a valid URL
            if (!fields.url) {
                return reject('Url is required');
            }

            try {
                const file = files['config-file'] ? files['config-file'][0] : null;
                const data: RequestData = {
                    config: file && file.size > 0 ? JSON.parse(await readFileAsync(file.path)) : null, // elsint-disable-line no-sync
                    rules: fields.rules,
                    source: fields.source ? fields.source[0] : ConfigSource.default,
                    url: fields.url ? fields.url[0] : null
                };

                return resolve(data);
            } catch (e) {
                return reject('Error parsing form');
            }
        });
    });
};

/** Convenience wrapper for synchronously reading file contents. */
export const readFile = (filePath: string): string => {
    return stripBom(fs.readFileSync(filePath, 'utf8')); // eslint-disable-line no-sync
};

/** Loads a JSON a file. */
export const loadJSONFile = (filePath: string) => {
    debug(`Loading JSON file: ${filePath}`);

    return JSON.parse(stripComments(readFile(filePath)));
};

/** Convenience wrapper to add a delay using promises. */
export const delay = (millisecs: number): Promise<object> => {
    return new Promise((resolve) => {
        setTimeout(resolve, millisecs);
    });
};

/**
 * Check if an array of sonar configurations is valid.
 * @param {Array<IConfig>} configs - Array of sonar configurations.
 */
export const validateServiceConfig = (configs: Array<IConfig>) => {
    const rules: Set<string> = new Set();

    for (const config of configs) {
        if (!validateConfig(config)) {
            throw new Error(`Invalid Configuration
${JSON.stringify(config)}`);
        }

        const normalizedRules = normalizeRules(config.rules);

        for (const [key] of Object.entries(normalizedRules)) {
            if (rules.has(key)) {
                throw new Error(`Rule ${key} repeated`);
            }

            rules.add(key);
        }
    }
};
