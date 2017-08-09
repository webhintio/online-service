import { status } from '../enums/status';

// TODO: add types.
export interface IJob {
    /** Job ID */
    id: string;
    /** Job Status */
    status: status;
    /** Configuration to run sonar */
    config;
    /** List of rules to run */
    rules;
    /** Timestamp when it was queued */
    queued: string;
    /** Timestamp when it was queued */
    started: string;
    /** Timestamp when it was queued */
    finished: string;
}
