import * as azure from 'azure-sb';
import { promisify } from 'util';

import { ServiceBusOptions } from '../../types/servicebus';
import { debug as d } from '../../utils/debug';

const debug: debug.IDebugger = d(__filename);

export class Queue {
    /** Azure service bus. */
    private serviceBus;
    /** Queue name. */
    private name: string;
    /** Queue options. */
    private options: ServiceBusOptions;

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

            const [message] = await this.serviceBus.receiveQueueMessageAsync(this.name, { isPeekLock: !remove });

            if (message.body) {
                message.data = JSON.parse(message.body);
            }

            return message;
        } catch (err) {
            // azure-sb package returns an error if there is no messages in the queue.
            if (err.message === 'No messages to receive') {
                return null;
            }

            debug('Error getting message', err);
            throw err;
        }
    }
}
