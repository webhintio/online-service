/* eslint no-process-exit:off */

import { launch, Page } from 'puppeteer';

import { Problem } from 'hint';

import { IJob, JobResult } from '../../types';
import * as logger from '../../utils/logging';

type Events = any;
type Results = any;

const moduleName: string = 'Webhint Runner';

const createErrorResult = (err): JobResult => {
    const jobResult: JobResult = {
        error: null,
        messages: null,
        ok: false
    };

    if (err instanceof Error) {
        // When we try to stringify an instance of Error, we just get an empty object.
        jobResult.error = JSON.stringify({
            message: err.message,
            stack: err.stack
        });
    } else {
        jobResult.error = JSON.stringify(err);
    }

    return jobResult;
};

process.once('uncaughtException', (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.send(createErrorResult(err));
    process.exit(1);
});

process.once('unhandledRejection', (reason: any) => {
    const source = reason.error ? reason.error : reason;

    console.log(source);
    /*
     * `reason` can not be an instance of Error, but its behavior with JSON.stringify is the same, returns {}
     * Creating a new Error we ensure that reason is going to be an instance of Error.
     */
    process.send(createErrorResult(new Error(source)));
    process.exit(1);
});

/** Watch for network requests and generate `fetch::*` events for the `webhint.js` bundle. */
const generateFetchEvents = (page: Page): void => {
    let events: Events[] = [];

    page.on('request', (request) => {
        events.push({ fetchStart: { resource: request.url() } });
    });

    page.on('requestfinished', async (request) => {
        const response = await request.response();

        // Ignore anything without a response or success status (e.g. redirects).
        if (!response || response.status() !== 200) {
            return;
        }

        events.push({
            fetchEnd: {
                element: null,
                request: {
                    headers: request.headers() as any,
                    url: request.url()
                },
                resource: request.url(),
                response: {
                    body: {
                        content: await response.text(),
                        rawContent: null as any,
                        rawResponse: null as any
                    },
                    charset: '',
                    headers: response.headers() as any,
                    hops: request.redirectChain().map((r) => {
                        return r.url();
                    }),
                    mediaType: '',
                    statusCode: response.status(),
                    url: response.url()
                }
            }
        });
    });

    page.exposeFunction('webhintReady', () => {
        const messages = events;

        events = [];

        return messages;
    });
};

/** Convert extension-browser `Results` structure back to a flat `Problem[]`. */
const getProblemsFromResults = (results: Results): Problem[] => {
    return results.categories.reduce((arrCat, category) => {
        return [...arrCat, ...category.hints.reduce((arrHint, hint) => {
            return [...arrHint, ...hint.problems];
        }, [] as Problem[])];
    }, [] as Problem[]);
};

/** Stub Web Extensions APIs and watch for results to be returned. */
const stubExtensionAPIs = (page: Page): Promise<Results> => {
    return page.evaluate(() => {
        return new Promise<Results>((resolve) => {
            let onMessage: ((events: Events) => void) = () => { };

            window.chrome = {
                runtime: {
                    onMessage: {
                        addListener: (fn: () => void) => {
                            onMessage = fn;
                        },
                        removeListener: () => { }
                    },
                    sendMessage: async (event: Events) => {
                        if (event.requestConfig) {
                            onMessage({ enable: {} });
                        }
                        if (event.ready) {
                            // Get `fetch` messages from `webhintReady` (injected by `generateFetchEvents`).
                            const messages = await (window as any).webhintReady();

                            messages.forEach((evt) => {
                                onMessage(evt);
                            });
                        }
                        if (event.results) {
                            resolve(event.results);
                        }
                    }
                }
            } as any;
        });
    });
};

/** Launch the target url in Puppeteer and inject `webhint.js` bundle. */
const runBundle = async (url: string): Promise<Problem[]> => {
    const browser = await launch();

    try {
        const page = (await browser.pages())[0];

        generateFetchEvents(page);

        /*
         * Forward console logs from the page for debugging.
         * page.on('console', (message) => {
         *     console.debug(message.text());
         * });
         */

        await page.goto(url);

        const resultsPromise = stubExtensionAPIs(page);

        await page.addScriptTag({ path: `${__dirname}/webhint.js` });

        const results = await resultsPromise;
        const problems = getProblemsFromResults(results);

        // console.log(problems);

        return problems;
    } finally {
        await browser.close();
    }
};

/**
 * Run a Job in webhint.
 * @param {IJob} job - Job to run in webhint.
 */
const run = async (job: IJob) => {
    logger.log(`Running job: ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName);
    let result: JobResult = {
        error: null,
        messages: null,
        ok: null
    };

    try {
        result.messages = await runBundle(job.url);
        result.ok = true;
    } catch (err) {
        logger.error(`Error runing job ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName, err);
        result = createErrorResult(err);
    }
    logger.log(`Sending result for job ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName);
    process.send(result);
};

process.on('message', run);
