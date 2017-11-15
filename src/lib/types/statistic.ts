import { JobStatus, RuleStatus } from '../enums/status';

export type DateParameter = {
    $gte?: Date;
};

export type StatisticQueryParameter = {
    $or?: Array<any>;
    status?: JobStatus;
    finished?: DateParameter;
    'rules.status'?: RuleStatus;
};

export type StatisticOptions = {
    field?: string;
    since?: Date;
};

export type StatusStatistic = {
    error?: number;
    finished?: number;
    pending?: number;
    started?: number;
};

export type UrlStatistic = {
    count: number;
    warning: number;
    error: number;
};

export type Statistic = {
    date: Date;
    status: StatusStatistic;
    statusLastHour?: StatusStatistic;
    scans: number;
    scansLastHour?: number;
    resultsQueue: number;
    syncQueue: number;
};
