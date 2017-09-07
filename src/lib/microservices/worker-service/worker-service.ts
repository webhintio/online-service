import * as _ from 'lodash';
import { fork, ChildProcess } from 'child_process'; // eslint-disable-line no-unused-vars
import { IConfig, IProblem } from '@sonarwhal/sonar/dist/src/lib/types'; // eslint-disable-line no-unused-vars
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';
import * as path from 'path';

import { debug as d } from '../../utils/debug';
import { Queue } from '../../common/queue/queue';
import { IJob, JobResult, Rule } from '../../types'; // eslint-disable-line no-unused-vars
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';

const debug: debug.IDebugger = d(__filename);

/**
 * Parse the result return for sonar.
 * @param {Array<rules>} rules - Rules in the job.
 * @param {IConfig} config - Sonar configuration.
 * @param {Array<IProblem>} result - Messages returned after run sonar.
 */
const parseResult = (rules: Array<Rule>, config: IConfig, result: Array<IProblem>) => {
    const groupedData: _.Dictionary<Array<IProblem>> = _.groupBy(result, 'ruleId');
    const configRules = normalizeRules(config.rules);

    rules.forEach((rule: Rule) => {
        // Skip rule if it is not in the configuration file.
        if (!configRules[rule.name]) {
            return;
        }
        const messages: Array<IProblem> = groupedData[rule.name];

        if (!messages || messages.length === 0) {
            rule.status = RuleStatus.pass;

            return;
        }

        rule.status = RuleStatus.error;
        rule.messages = messages;
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
        logger.error('Error closing sonar process');
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
            debug(`Message from sonar process received for job: ${job.id}`);
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            killProcess(runner);

            if (result.ok) {
                return resolve(result.messages);
            }

            return reject(result.error);
        });

        runner.send(job);

        timeoutId = setTimeout(() => {
            debug(`Job with id: ${job.id} timeout. Killing process and reporting an error`);
            killProcess(runner);

            reject(new Error('TIMEOUT'));
        }, job.maxRunTime * 1000 || 180000);
    });
};

export const run = async () => {
    const queue = new Queue('sonar-jobs', process.env.queue); // eslint-disable-line no-process-env
    const queueResults = new Queue('sonar-results', process.env.queue); // eslint-disable-line no-process-env

    const listener = async (job: IJob) => {
        debug(`Job received: ${job.id}`);
        try {
            job.started = new Date();
            job.status = JobStatus.started;

            debug(`Changing job status to ${job.status}`);
            await queueResults.sendMessage(job);

            const result: Array<IProblem> = await runSonar(job);

            parseResult(job.rules, job.config, result);

            job.finished = new Date();
            job.status = JobStatus.finished;

            debug(`Sending job result with status: ${job.status}`);
            queueResults.sendMessage(job);
        } catch (err) {
            debug(`Error runing job: ${job.id}`);
            debug(err);

            job.error = err;
            job.status = JobStatus.error;

            debug(`Sending job result with status: ${job.status}`);
            queueResults.sendMessage(job);
        }
    };

    await queue.listen(listener);

    return 0;
};


if (process.argv[1].includes('worker-service.js')) {
    run();
}
