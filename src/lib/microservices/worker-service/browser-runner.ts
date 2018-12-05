/* eslint no-process-exit:off */

import { launch } from 'puppeteer';

import { Problem } from 'hint/dist/src/lib/types';

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

process.once('unhandledRejection', (reason) => {
    const source = reason.error ? reason.error : reason;

    console.log(source);
    // reason can not be an instance of Error, but its behavior with JSON.stringify is the same, returns {}
    // Creating a new Error we ensure that reason is going to be an instance of Error.
    process.send(createErrorResult(new Error(source)));
    process.exit(1);
});

const getProblemsFromResults = (results: Results): Problem[] => {
    return results.categories.reduce((arrCat, category) => {
        return [...arrCat, ...category.hints.reduce((arrHint, hint) => {
            return [...arrHint, ...hint.problems];
        }, [] as Problem[])];
    }, [] as Problem[]);
};

const runBundle = async (url: string): Promise<Problem[]> => {
    const browser = await launch();
    const page = (await browser.pages())[0];

    let events: Events[] = [];

    page.on('request', (request) => {
        events.push({ fetchStart: { resource: request.url() } });
    });

    page.on('requestfinished', async (request) => {
        const response = await request.response();

        if (!response) {
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

    await page.goto(url);

    const resultsPromise: Promise<Results> = page.evaluate(() => {
        return new Promise<Results>((resolve) => {
            let onMessage: ((events: Events) => void) = () => {};

            window.chrome = {
                runtime: {
                    onMessage: {
                        addListener: (fn: () => void) => {
                            onMessage = fn;
                        },
                        removeListener: () => {}
                    },
                    sendMessage: (event: Events) => {
                        if (event.requestConfig) {
                            onMessage({ enable: {} });
                        }
                        if (event.ready) {
                            events.forEach((evt) => {
                                onMessage(evt);
                            });
                            events = [];
                        }
                        if (event.results) {
                            resolve(event.results);
                        }
                    }
                }
            } as any;
        });
    });

    await page.addScriptTag({ path: `${__dirname}/webhint.js` });

    return getProblemsFromResults(await resultsPromise);
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
