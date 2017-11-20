import { JobStatus, RuleStatus } from '../enums/status';

export type DateParameter = {
    $gte?: Date;
};

export type StatQueryParameter = {
    $or?: Array<any>;
    status?: JobStatus;
    finished?: DateParameter;
    'rules.status'?: RuleStatus;
};

export type StatOptions = {
    field?: string;
    since?: Date;
};

export type StatusStat = {
    error?: number;
    finished?: number;
    pending?: number;
    started?: number;
};

export type UrlStat = {
    count: number;
    warning: number;
    error: number;
};

export type Stat = {
    date: Date;
    status: StatusStat;
    statusLastHour?: StatusStat;
    scans: number;
    scansLastHour?: number;
    resultsQueue: number;
    syncQueue: number;
};
