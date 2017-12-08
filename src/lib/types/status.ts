export type StatusQueue = {
    /** # of items in the jobs queue. */
    jobs: number;
    /** # of items in the results queue. */
    results: number;
};

export type StatusAverage = {
    /** Average time to completely process a job. */
    finish: number;
    /** Average time to start processing a job. */
    start: number;
};

export type StatusFinished = {
    /** # of scans finished with error. */
    error: number;
    /** # of scans successfuly finished. */
    success: number;
};

export type StatusScans = {
    /** # of scans created. */
    created: number;
    /** # of scans finished. */
    finished: StatusFinished;
    /** # of scans started. */
    started: number;
};

export interface IStatusUrl {
    /** # of errors in this url for a rule. */
    errors: number;
    /** Indicates if the url pass the rule. */
    passes: number;
    /** # of warnings in this url for a rule. */
    warnings: number;
    url: string;
}

export interface IStatusRuleDetail {
    /** # of urls with at least one error in the rule. */
    errors: number;
    /** # of urls passing the rule. */
    passes: number;
    /** # of urls with at least one warning in the rule. */
    warnings: number;
    /** list of urls. */
    urls: Array<IStatusUrl>;
}

export type StatusRuleDetailList = {
    [key: string]: IStatusRuleDetail;
};

export interface IStatusRules {
    /** Total of urls with error in some rule. */
    errors: number;
    /** Total of urls that pass a rule. */
    passes: number;
    /** Total of urls with warning in some rule. */
    warnings: number;
    rules: StatusRuleDetailList;
}

export interface IStatus {
    /** Average time to start and finish jobs. */
    average: StatusAverage;
    /** Status date. */
    date: Date;
    /** Queue status. */
    queues: StatusQueue;
    /** Rules status. */
    rules: IStatusRules;
    /** Scans status. */
    scans: StatusScans;
}
