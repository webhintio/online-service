import { IJob } from './job';

export type ServiceBusListenerOptions = {
    autoDeleteMessages?: boolean;
    messagesToGet?: number;
    pooling?: number;
};

export type ServiceBusMessage = {
    [key: string]: any;
    data: IJob;
};
