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
    /** # of errors in this url for a hint. */
    errors: number;
    /** Indicates if the url pass the hint. */
    passes: number;
    /** # of warnings in this url for a hint. */
    warnings: number;
    url: string;
}

export interface IStatusHintDetail {
    /** # of urls with at least one error in the hint. */
    errors: number;
    /** # of urls passing the hint. */
    passes: number;
    /** # of urls with at least one warning in the hint. */
    warnings: number;
    /** list of urls. */
    urls: Array<IStatusUrl>;
}

export type StatusHintDetailList = {
    [key: string]: IStatusHintDetail;
};

export interface IStatusHints {
    /** Total of urls with error in some hint. */
    errors: number;
    /** Total of urls that pass a hint. */
    passes: number;
    /** Total of urls with warning in some hint. */
    warnings: number;
    hints: StatusHintDetailList;
}

export interface IStatus {
    /** Average time to start and finish jobs. */
    average: StatusAverage;
    /** Status date. */
    date: Date;
    /** Queue status. */
    queues: StatusQueue;
    /** Hints status. */
    hints: IStatusHints;
    /** Scans status. */
    scans: StatusScans;
}
