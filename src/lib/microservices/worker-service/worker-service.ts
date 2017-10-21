import * as _ from 'lodash';
import { fork, ChildProcess } from 'child_process';
import { IProblem, Severity } from '@sonarwhal/sonar/dist/src/lib/types';
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';
import * as path from 'path';

import { debug as d } from '../../utils/debug';
import { Queue } from '../../common/queue/queue';
import { IJob, JobResult, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';
import { generateLog } from '../../utils/misc';

const debug: debug.IDebugger = d(__filename);
const moduleName: string = 'Worker Service';

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

        rule.messages = [{
            location: {
                column: -1,
                elementColumn: -1,
                elementLine: -1,
                line: -1
            },
            message: 'This rule has a lot errors, please use Sonar in your local machine for more errors details',
            resource: null,
            ruleId: rule.messages[0].ruleId,
            severity: rule.messages[0].severity,
            sourceCode: null
        }];
    });
};

/**
 * Send a message to the queue for each rule in the configuration.
 * @param {Queue} queue - Queue where to send the messages.
 * @param {IJob} job - Job to get the messages.
 * @param normalizedRules - Normalized job rules.
 */
const sendMessages = async (queue: Queue, job: IJob, normalizedRules) => {
    const cloneRules = job.rules.slice(0);
    const cloneJob = _.cloneDeep(job);

    for (const rule of cloneRules) {
        if (normalizedRules[rule.name]) {
            cloneJob.rules = [rule];

            try {
                logger.log(generateLog('Sending message for Job', cloneJob, { showRule: true }), moduleName);
                await queue.sendMessage(cloneJob);
            } catch (err) {
                // The status code can be 413 or 400.
                if (err.statusCode === 413 || (err.statusCode === 400 && err.message.includes('The body of the message is too large.'))) {
                    cleanMessagesInRules(cloneJob, normalizedRules);

                    await queue.sendMessage(cloneJob);
                } else {
                    throw err;
                }
            }
        }
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
    const queue: Queue = new Queue('sonar-jobs', process.env.queue); // eslint-disable-line no-process-env
    const queueResults: Queue = new Queue('sonar-results', process.env.queue); // eslint-disable-line no-process-env
    const sonarVersion: string = getSonarVersion();

    const listener = async (job: IJob) => {
        logger.log(generateLog('Processing Job', job), moduleName);
        const normalizedRules = normalizeRules(job.config[0].rules);

        try {
            job.sonarVersion = sonarVersion;

            await sendStartedMessage(queueResults, job);

            const result: Array<IProblem> = await runSonar(job);

            parseResult(job, result, normalizedRules);

            job.finished = new Date();
            job.status = JobStatus.finished;

            debug(`Sending job result with status: ${job.status}`);

            await sendMessages(queueResults, job, normalizedRules);

            logger.log(generateLog('Processed Job', job), moduleName);
        } catch (err) {
            logger.error(generateLog('Error processing Job', job), moduleName, err);
            debug(err);

            setRulesToError(job, normalizedRules);

            await sendErrorMessage(err, queueResults, job);

            return;
        }
    };

    await queue.listen(listener);

    return 0;
};

if (process.argv[1].includes('worker-service.js')) {
    run();
}
