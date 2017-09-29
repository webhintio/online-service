import * as _ from 'lodash';
import { fork, ChildProcess } from 'child_process';
import { IConfig, IProblem, Severity } from '@sonarwhal/sonar/dist/src/lib/types';
import normalizeRules from '@sonarwhal/sonar/dist/src/lib/utils/normalize-rules';
import * as path from 'path';

import { debug as d } from '../../utils/debug';
import { Queue } from '../../common/queue/queue';
import { IJob, JobResult, Rule } from '../../types';
import { JobStatus, RuleStatus } from '../../enums/status';
import * as logger from '../../utils/logging';

const debug: debug.IDebugger = d(__filename);
const moduleName: string = 'Worker Service';

/**
 * Parse the result return for sonar.
 * @param {Array<rules>} rules - Rules in the job.
 * @param {IConfig} config - Sonar configuration.
 * @param {Array<IProblem>} result - Messages returned after run sonar.
 */
const parseResult = (rules: Array<Rule>, config: Array<IConfig>, result: Array<IProblem>) => {
    const groupedData: _.Dictionary<Array<IProblem>> = _.groupBy(result, 'ruleId');
    const configRules = normalizeRules(config[0].rules);

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

        rule.status = Severity.error === messages[0].severity ? RuleStatus.error : RuleStatus.warning;
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
            logger.log(`Message from sonar process received for job: ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName);
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

const getSonarVersion = (): string => {
    const pkg = require('@sonarwhal/sonar/package.json');

    return pkg.version;
};

export const run = async () => {
    const queue: Queue = new Queue('sonar-jobs', process.env.queue); // eslint-disable-line no-process-env
    const queueResults: Queue = new Queue('sonar-results', process.env.queue); // eslint-disable-line no-process-env
    const sonarVersion: string = getSonarVersion();

    const listener = async (job: IJob) => {
        logger.log(`Processing Job: ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName);
        try {
            job.started = new Date();
            job.status = JobStatus.started;
            job.sonarVersion = sonarVersion;

            debug(`Changing job status to ${job.status}`);
            await queueResults.sendMessage(job);

            const result: Array<IProblem> = await runSonar(job);

            parseResult(job.rules, job.config, result);

            job.finished = new Date();
            job.status = JobStatus.finished;

            debug(`Sending job result with status: ${job.status}`);
            await queueResults.sendMessage(job);

        } catch (err) {
            logger.error(`Error processing Job: ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName, err);
            debug(err);

            if (err instanceof Error) {
                // When we try to stringify an instance of Error, we just get an empty object.
                job.error = {
                    message: err.message,
                    stack: err.stack
                };
            } else {
                job.error = err;
            }

            job.status = JobStatus.error;
            job.finished = new Date();

            debug(`Sending job result with status: ${job.status}`);
            await queueResults.sendMessage(job);
        }
        logger.log(`Processed Job: ${job.id} - Part ${job.partInfo.part} of ${job.partInfo.totalParts}`, moduleName);
    };

    await queue.listen(listener);

    return 0;
};

if (process.argv[1].includes('worker-service.js')) {
    run();
}
