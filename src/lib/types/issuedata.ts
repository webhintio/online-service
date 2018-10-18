import { UserConfig } from 'hint/dist/src/lib/types';

export type IssueData = {
    errorMessage?: string;
    configs?: Array<UserConfig>;
    errorType?: 'crash' | 'stderr' | 'timeout';
    log?: string;
    scan: string;
    url: string;
};
