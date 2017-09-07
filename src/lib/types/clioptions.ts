import { Microservice } from '../enums/microservice';

export type CLIOptions = {
    help: string;
    microservice: Microservice;
    version: boolean;
    // Config manager options
    name: string;
    file: string;
    activate: boolean;
    list: boolean;
    cache: number;
    run: number;
};
