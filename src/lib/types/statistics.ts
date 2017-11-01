import { JobStatus, RuleStatus } from '../enums/status';

export type DateParameter = {
    $gte?: Date;
};

export type StatisticsQueryParameter = {
    $or?: Array<any>;
    status?: JobStatus;
    finished?: DateParameter;
    'rules.status'?: RuleStatus;
};

export type StatisticsOptions = {
    field?: string;
    since?: Date;
};

export type StatusStatistics = {
    error?: number;
    finished?: number;
    pending?: number;
    started?: number;
};

export type UrlStatistics = {
    count: number;
    warning: number;
    error: number;
};

export type Statistics = {
    status: StatusStatistics;
    statusLastHour: StatusStatistics;
    scans: number;
    scansLastHour: number;
};
