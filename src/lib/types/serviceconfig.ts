import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types'; // eslint-disable-line no-unused-vars

export interface IServiceConfig {
    /** Default sonar configuration. */
    sonarConfig: IConfig;
    /** Time in seconds to keep a job in the cache. */
    jobCacheTime: number;
    /** Time in seconds a job has to complete the execution in sonar. */
    jobRunTime: number;
    /** Configuration name. */
    name: string;
    /** Indicates if a configuration is the active one or not. */
    active: boolean;
}
