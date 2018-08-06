import { UserConfig, Problem } from 'hint/dist/src/lib/types';

import { ConfigSource } from '../enums/configsource';
import { JobStatus, HintStatus } from '../enums/status';

export type Hint = {
    category: string;
    name: string;
    status: HintStatus;
    messages: Array<Problem>;
};

export type JobResult = {
    error: string;
    ok: boolean;
    messages: Array<Problem>;
};

export type JobData = {
    config;
    hints: Array<string>;
    source: ConfigSource;
    url: string;
};

export type PartInfo = {
    /** Part number for a task */
    part?: number;
    /** Total parts we split a job */
    totalParts?: number;
};

export interface IJob {
    /** job id in database. */
    id?: string;
    /** Job Url. */
    url: string;
    /** Job Status. */
    status: JobStatus;
    /** Configuration to run webhint. */
    config: Array<UserConfig>;
    /** Time in seconds the job has to complete the execution in webhint. */
    maxRunTime: number;
    /** DEPRECATED */
    rules: Array<Hint>;
    /** List of hints to run. */
    hints: Array<Hint>;
    /** Webhint version. */
    webhintVersion: string;
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
    /** Partition information for a task */
    partInfo?: PartInfo;
    /** Indicates if a job was investigated for someone */
    investigated?: boolean;
}
