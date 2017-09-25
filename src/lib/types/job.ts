import { IConfig, IProblem } from '@sonarwhal/sonar/dist/src/lib/types';

import { JobStatus, RuleStatus } from '../enums/status';

export type Rule = {
    name: string;
    status: RuleStatus;
    messages: Array<IProblem>;
};

export type JobResult = {
    error: string;
    ok: boolean;
    messages: Array<IProblem>;
};

export interface IJob {
    /** job id in database. */
    id?: string;
    /** Job Url. */
    url: string;
    /** Job Status. */
    status: JobStatus;
    /** Configuration to run sonar. */
    config: Array<IConfig>;
    /** Time in seconds the job has to complete the execution in sonar. */
    maxRunTime: number;
    /** List of rules to run. */
    rules: Array<Rule>;
    /** Sonar version. */
    sonarVersion: string;
    /** Timestamp when it was queued. */
    queued: Date;
    /** Timestamp when it was queued. */
    started: Date;
    /** Timestamp when it was queued. */
    finished: Date;
    /** Error in case there is an error runing the job. */
    error: any;
    /** Messages in queue approximately before the job is added to the queue. */
    messagesInQueue?: number;
    /** Part number for a task */
    part?: number;
    /** Total parts we split a job */
    totalParts?: number;
}
