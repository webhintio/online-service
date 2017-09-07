import { IConfig, IProblem, Severity } from '@sonarwhal/sonar/dist/src/lib/types'; // eslint-disable-line no-unused-vars

import { JobStatus, RuleStatus } from '../enums/status';

export type Rule = {
    name: string;
    status: RuleStatus;
    messages: Array<IProblem>;
};

export type JobResult = {
    error: Error;
    ok: boolean;
    messages: Array<IProblem>;
};

export interface IJob {
    /** job id in database */
    id?: string;
    /** Job Url */
    url: string;
    /** Job Status */
    status: JobStatus;
    /** Configuration to run sonar */
    config: IConfig;
    /** Time in seconds the job has to complete the execution in sonar. */
    maxRunTime: number;
    /** List of rules to run */
    rules: Array<Rule>;
    /** Timestamp when it was queued */
    queued: Date;
    /** Timestamp when it was queued */
    started: Date;
    /** Timestamp when it was queued */
    finished: Date;
    /** Error message in case there is an error runing the job*/
    error: string;
}
