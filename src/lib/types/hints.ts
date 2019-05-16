import { HintsConfigObject } from '../types';

export declare enum Category {
    accessibility = 'accessibility',
    development = 'development',
    compatibility = 'compatibility',
    interoperability = 'interoperability',
    other = 'other',
    pwa = 'pwa',
    performance = 'performance',
    pitfalls = 'pitfalls',
    security = 'security'
}
export declare enum Severity {
    off = 0,
    warning = 1,
    error = 2
}
export declare type ProblemLocation = {
    column: number;
    line: number;
    elementColumn?: number;
    elementLine?: number;
};
export declare type Problem = {
    location: ProblemLocation;
    message: string;
    sourceCode: string;
    resource: string;
    hintId: string;
    category: Category;
    severity: Severity;
};
export declare type HintSeverity = Severity | keyof typeof Severity;
export declare type HintConfig = HintSeverity | [HintSeverity, any];
export declare type HintsConfigObject = {
    [key: string]: HintConfig | HintConfig[];
};
export declare type ConnectorOptionsConfig = {
    waitFor?: number;
    watch?: boolean;
};
export declare type ConnectorConfig = {
    name: string;
    options?: ConnectorOptionsConfig;
};
export declare type IgnoredUrl = {
    domain: string;
    hints: string[];
};
export declare type UserConfig = {
    connector?: ConnectorConfig | string;
    extends?: string[];
    parsers?: string[];
    hints?: HintsConfigObject | [HintSeverity, HintConfig][];
    browserslist?: string | string[];
    hintsTimeout?: number;
    formatters?: string[];
    ignoredUrls?: IgnoredUrl[];
};
export declare const validateConfig: (config: UserConfig) => boolean;
