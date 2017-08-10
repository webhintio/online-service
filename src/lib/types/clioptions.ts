import { Microservice } from '../enums/microservice';

export type CLIOptions = {
    help: string;
    microservice: Microservice;
    version: boolean;
};
