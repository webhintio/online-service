import { UserConfig } from 'hint/dist/src/lib/types';

export type IssueData = {
    errorMessage?: string;
    configs?: Array<UserConfig>;
    errorType?: 'crash' | 'stderr' | 'timeout';
    scan: string;
    url: string;
};
