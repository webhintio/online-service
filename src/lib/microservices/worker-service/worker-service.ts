import * as _ from 'lodash';
import { fork, ChildProcess } from 'child_process';
import { IProblem, Severity } from '@sonarwhal/sonar/dist/src/lib/types';
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';
import * as path from 'path';

import * as appInsight from '../../utils/appinsights';
import { debug as d } from '../../utils/debug';
import { Queue } from '../../common/queue/queue';
import { IJob, JobResult, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';

const queueConnectionString = process.env.queue; // eslint-disable-line no-process-env
const appInsightClient = appInsight.getClient();
const debug: debug.IDebugger = d(__filename);
const moduleName: string = 'Worker Service';
const MAX_MESSAGE_SIZE = 220 * 1024; // size in kB

/**
 * Parse the result returned for sonar.
 * @param {IJob} job - Job to write the result.
 * @param normalizedRules - Normalized job rules.
 */
const parseResult = (job: IJob, result: Array<IProblem>, normalizedRules) => {
    const rules: Array<Rule> = job.rules;
    const groupedData: _.Dictionary<Array<IProblem>> = _.groupBy(result, 'ruleId');

    rules.forEach((rule: Rule) => {
        // Skip rule if it is not in the configuration file.
        if (!normalizedRules[rule.name]) {
            return;
        }
        const messages: Array<IProblem> = groupedData[rule.name];

        if (!messages || messages.length === 0) {
            rule.status = RuleStatus.pass;

            return;
        }

        rule.status = Severity.error === messages[0].severity ? RuleStatus.error : RuleStatus.warning;
        rule.messages = messages;
    });
};

/**
 * Determine if a rule is off or not.
 * @param ruleConfiguration Rule configuration.
 */
const ruleOff = (ruleConfiguration) => {
    if (Array.isArray(ruleConfiguration)) {
        return ruleConfiguration[0] === 'off';
    }

    return ruleConfiguration === 'off';
};

/**
 * Set each rule in the configuration to error.
 * @param {IJob} job - Job to write the errors.
 * @param normalizedRules - Normalized job rules.
 */
const setRulesToError = (job: IJob, normalizedRules) => {
    const rules: Array<Rule> = job.rules;

    rules.forEach((rule: Rule) => {
        const ruleConfiguration = normalizedRules[rule.name];

        // Skip rule if it is not in the configuration file.
        if (!ruleConfiguration) {
            return;
        }

        if (ruleOff(ruleConfiguration)) {
            rule.status = RuleStatus.pass;

            return;
        }

        rule.status = RuleStatus.error;

        rule.messages = [{
            location: {
                column: -1,
                elementColumn: -1,
                elementLine: -1,
                line: -1
            },
            message: 'Error in sonar analyzing this rule',
            resource: null,
            ruleId: rule.name,
            severity: Severity.error,
            sourceCode: null
        }];
    });
};

/**
 * Kill a given process.
 * @param {ChildProcess} runner Process to kill.
 */
const killProcess = (runner: ChildProcess) => {
    try {
        runner.kill('SIGKILL');
    } catch (err) {
        logger.error('Error closing sonar process', moduleName);
    }
};

/**
 * Create a child process to run sonar.
 * @param {IJob} job - Job to run in sonar.
 */
const runSonar = (job: IJob): Promise<Array<IProblem>> => {
    return new Promise((resolve, reject) => {
        // if we don't set execArgv to [], when the process is created, the execArgv
        // has the same parameters as his father so if we are debugging, the child
        // process try to debug in the same port, and that throws an error.
        const runner: ChildProcess = fork(path.join(__dirname, 'sonar-runner'), [], { execArgv: [] });
        let timeoutId: NodeJS.Timer;

        runner.on('message', (result: JobResult) => {
            logger.log(generateLog('Message from sonar process received for job', job), moduleName);
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            killProcess(runner);

            if (result.ok) {
                return resolve(result.messages);
            }

            return reject(JSON.parse(result.error));
        });

        runner.send(job);

        timeoutId = setTimeout(() => {
            debug(`Job with id: ${job.id} timeout. Killing process and reporting an error`);
            killProcess(runner);

            reject(new Error('TIMEOUT'));
        }, job.maxRunTime * 1000 || 180000);
    });
};

/**
 * Return the sonar version the worker is using.
 */
const getSonarVersion = (): string => {
    const pkg = require('@sonarwhal/sonar/package.json');

    return pkg.version;
};

/** Directly removes the messages for a rule with a "Too many errors" message.
 * @param {Rule} rule The rule to clean.
 */
const tooManyErrorsMessage = (rule: Rule): Rule => {
    rule.messages = [{
        location: {
            column: -1,
            elementColumn: -1,
            elementLine: -1,
            line: -1
        },
        message: 'This rule has too many errors, please use sonar locally for more details',
        resource: null,
        ruleId: rule.messages[0].ruleId,
        severity: rule.messages[0].severity,
        sourceCode: null
    }];

    return rule;
};

/**
 * Clean all messages in rules and set a default one.
 * @param {IJob} job Job to clean.
 * @param normalizedRules - Normalized job rules.
 */
const cleanMessagesInRules = (job: IJob, normalizedRules) => {
    job.rules.forEach((rule) => {
        if (rule.status === RuleStatus.pending || rule.status === RuleStatus.pass || !normalizedRules[rule.name]) {
            return;
        }

        tooManyErrorsMessage(rule);
    });
};

/**
 * Sends a message with the results of a job.
 * @param {Queue} queue - Queue where to send the message.
 * @param job - Job processed that needs update.
 * @param normalizedRules - Normalized job rules.
 */
const sendMessage = async (queue: Queue, job: IJob, normalizedRules) => {
    try {
        logger.log(generateLog('Sending message for Job', job, { showRule: true }), moduleName);
        await queue.sendMessage(job);
    } catch (err) {
        // The status code can be 413 or 400.
        if (err.statusCode === 413 || (err.statusCode === 400 && err.message.includes('The body of the message is too large.'))) {
            cleanMessagesInRules(job, normalizedRules);
            await queue.sendMessage(job);
        } else {
            throw err;
        }
    }
};

/**
 * Sends the results to the results queue.
 * @param {Queue} queue - Queue where to send the messages.
 * @param {IJob} job - Job to get the messages.
 * @param normalizedRules - Normalized job rules.
 */
const sendResults = async (queue: Queue, job: IJob, normalizedRules) => {
    let messageSize = JSON.stringify(job).length;

    if (messageSize <= MAX_MESSAGE_SIZE) {
        await sendMessage(queue, job, normalizedRules);

        return;
    }

    const cloneRules = job.rules.slice(0);
    const cloneJob = _.cloneDeep(job);

    cloneJob.rules = [];

    while (cloneRules.length > 0) {
        let rule = cloneRules.pop();
        let ruleSize = JSON.stringify(rule).length;

        if (!normalizedRules[rule.name]) {
            continue; // eslint-disable-line no-continue
        }

        if (ruleSize > MAX_MESSAGE_SIZE) {
            rule = tooManyErrorsMessage(rule);
            ruleSize = JSON.stringify(rule).length;
        }

        messageSize = JSON.stringify(cloneJob).length;

        // Size is too big with the latest rule, we have to send all the previous ones
        if (messageSize + ruleSize > MAX_MESSAGE_SIZE) {
            // We send the previous version of `cloneJob`
            await sendMessage(queue, cloneJob, normalizedRules);
            // We clean `cloneJob`'s rules to not repeat results and add the new one
            cloneJob.rules = [rule];
        } else {
            // Add rule to job
            cloneJob.rules.push(rule);
        }
    }

    // We might not have reached MAX_MESSAGE_SIZE with the last rule, send any remaining ones
    if (cloneJob.rules.length > 0) {
        await sendMessage(queue, cloneJob, normalizedRules);
    }
};

/**
 * Send the job to the queue with the status `started`
 * @param {Queue} queue - Queue to send the message.
 * @param {IJob} job - Job to send in the message.
 */
const sendStartedMessage = async (queue: Queue, job: IJob) => {
    job.started = new Date();
    job.status = JobStatus.started;

    debug(`Changing job status to ${job.status}`);
    await queue.sendMessage(job);

    logger.log(generateLog('Started message sent for Job', job), moduleName);
};

/**
 * Send a job with an error to the queue.
 * @param error - Error to set in the job.
 * @param {Queue} queue - Queue to send the message
 * @param {IJob} job - Job to send to the queue
 */
const sendErrorMessage = async (error, queue: Queue, job: IJob) => {
    if (error instanceof Error) {
        // When we try to stringify an instance of Error, we just get an empty object.
        job.error = {
            message: error.message,
            stack: error.stack
        };
    } else {
        job.error = error;
    }

    job.status = JobStatus.error;
    job.finished = new Date();

    debug(`Sending job result with status: ${job.status}`);
    await queue.sendMessage(job);
};

export const run = async () => {
    const queue: Queue = new Queue('sonar-jobs', queueConnectionString);
    const queueResults: Queue = new Queue('sonar-results', queueConnectionString);
    const sonarVersion: string = getSonarVersion();

    const listener = async (jobs: Array<IJob>) => {
        const start = Date.now();
        const job = jobs[0];

        logger.log(generateLog('Processing Job', job), moduleName);
        const normalizedRules = normalizeRules(job.config[0].rules);

        try {
            job.sonarVersion = sonarVersion;

            await sendStartedMessage(queueResults, job);

            const sonarStart = Date.now();
            const result: Array<IProblem> = await runSonar(job);

            appInsightClient.trackMetric({
                name: 'run-sonar',
                value: Date.now() - sonarStart
            });

            parseResult(job, result, normalizedRules);

            job.finished = new Date();
            job.status = JobStatus.finished;

            debug(`Sending job result with status: ${job.status}`);

            await sendResults(queueResults, job, normalizedRules);

            logger.log(generateLog('Processed Job', job), moduleName);

            appInsightClient.trackMetric({
                name: 'run-worker',
                value: Date.now() - start
            });
        } catch (err) {
            logger.error(generateLog('Error processing Job', job), moduleName, err);
            appInsightClient.trackException({ exception: err });
            debug(err);

            setRulesToError(job, normalizedRules);

            await sendErrorMessage(err, queueResults, job);

            return;
        }
    };

    try {
        await queue.listen(listener, { messagesToGet: 1 });

        logger.log('Service finished\nExiting with status 0', moduleName);

        return 0;
    } catch (err) {
        logger.error('Error in Worker service\nExiting with status 1', moduleName);

        return 1;
    }
};

if (process.argv[1].includes('worker-service.js')) {
    run();
}
