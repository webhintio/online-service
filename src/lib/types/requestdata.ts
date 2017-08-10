import { ConfigSource } from '../enums/configsource';

export type RequestData = {
    config;
    rules: Array<string>;
    source: ConfigSource;
    url: string;
};
