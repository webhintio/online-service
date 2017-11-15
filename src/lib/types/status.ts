export type StatusQueue = {
    jobs: number;
    results: number;
};

export type StatusAverage = {
    finish: number;
    start: number;
};

export type StatusFinished = {
    error: number;
    success: number;
};

export type StatusScans = {
    created: number;
    finished: StatusFinished;
    started: number;
};

export interface IStatus {
    average: StatusAverage;
    date: Date;
    queues: StatusQueue;
    scans: StatusScans;
}
