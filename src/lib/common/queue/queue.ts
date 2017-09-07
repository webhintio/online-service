import * as azure from 'azure-sb';
import { promisify } from 'util';

import { ServiceBusOptions } from '../../types';
import { debug as d } from '../../utils/debug';
import * as logger from '../../utils/logging';
import { delay } from '../../utils/misc';

const debug: debug.IDebugger = d(__filename);

export class Queue {
    /** Azure service bus. */
    private serviceBus;
    /** Queue name. */
    private name: string;
    /** Queue options. */
    private options: ServiceBusOptions;
    /** If the listener has to stop. */
    private stop: boolean;
    /** Handler for a listener. */
    private handler: Function;
    /** Pooling time for the listener. */
    private pooling: number = 1000;
    /** Timeout id for the listener scheduler. */
    private timeoutId: number;

    /**
     * @constructor
     * @param {string} name - Queue name.
     * @param {string} connectionString - Connection string to ServiceBus.
     * @param {ServiceBusOptions} options - Options.
     */
    public constructor(name: string, connectionString: string) {
        this.name = name;
        this.serviceBus = azure.createServiceBusService(connectionString);
        this.serviceBus.sendQueueMessageAsync = promisify(this.serviceBus.sendQueueMessage);
        this.serviceBus.receiveQueueMessageAsync = promisify(this.serviceBus.receiveQueueMessage);
    }

    /**
     * Send a message to service bus.
     * @param {any} message - Message to send to the queue.
     * */
    public sendMessage(message: any) {
        debug('Sending message to queue');

        return this.serviceBus.sendQueueMessageAsync(this.name, { body: JSON.stringify(message) });
    }

    /**
     * Get a message from service bus.
     * @param {boolean} remove - Remove the value from the queue.
     * */
    public async getMessage(remove?: boolean) {
        try {
            debug(`Getting message in queue ${this.name}`);

            const message = await this.serviceBus.receiveQueueMessageAsync(this.name, { isPeekLock: !remove });

            if (message.body) {
                message.data = JSON.parse(message.body);
            }

            return message;
        } catch (err) {
            // azure-sb package returns an error if there is no messages in the queue.
            if (err === 'No messages to receive') {
                return null;
            }

            debug('Error getting message', err);
            throw err;
        }
    }

    private async checkQueue() {
        let message;

        try {
            message = await this.getMessage(true);
        } catch (err) {
            message = null;

            if (err.code !== 'ETIMEDOUT') {
                logger.error('Error getting message', err);
            }

            if (err.statusCode === 503) {
                return 10000; // Throttling error. We need to wait 10 seconds for the next request.
            }
        }

        if (!message) {
            return null;
        }

        try {
            await this.handler(message.data);

            return 0;
        } catch (err) {
            logger.error(`Error processing message: \n${JSON.stringify(message)}`, err);

            return null;
        }
    }

    public async listen(handler: Function, options?): Promise<void> {
        if (!handler) {
            throw new Error('Listen needs a handler to work');
        }

        if (this.handler) {
            throw new Error('There is already a listener defined. Stop the previous one');
        }

        if (options && options.pooling) {
            this.pooling = options.pooling;
        }

        this.stop = false;
        this.handler = handler;

        while (!this.stop) {
            const waitingTime = await this.checkQueue();

            await delay(typeof waitingTime === 'number' ? waitingTime : this.pooling);
        }
    }

    public stopListener() {
        this.stop = true;
        this.handler = null;
    }
}
