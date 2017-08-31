import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types'; // eslint-disable-line no-unused-vars

import { JobStatus, RuleStatus } from '../enums/status';

export type Rule = {
    name: string;
    status: RuleStatus;
    messages: Array<string>;
};

export interface IJob {
    /** Job Url */
    url: string;
    /** Job Status */
    status: JobStatus;
    /** Configuration to run sonar */
    config: IConfig;
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
