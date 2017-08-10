import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const azureSB = { createServiceBusService() { } };

const azureSBService = {
    receiveQueueMessage() { },
    sendQueueMessage() { }
};

proxyquire('../../../../src/lib/common/queue/queue', { 'azure-sb': azureSB });

import { Queue } from '../../../../src/lib/common/queue/queue';

test.beforeEach((t) => {
    sinon.stub(azureSB, 'createServiceBusService').returns(azureSBService);

    t.context.azureSB = azureSB;
});

test.afterEach.always((t) => {
    t.context.azureSB.createServiceBusService.restore();
});

test.serial('Constructor should create the instance of azure service bus', (t) => {
    const queue = new Queue('QueueName', 'connectionString'); // eslint-disable-line no-unused-vars

    t.true(t.context.azureSB.createServiceBusService.calledOnce);
});

test.serial('sendMessage should send a message to service bus', async (t) => {
    sinon.stub(azureSBService, 'sendQueueMessage').callsFake((param1, param2, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    await queue.sendMessage(message);

    t.true(t.context.azureSBService.sendQueueMessage.calledOnce);
    t.is(t.context.azureSBService.sendQueueMessage.args[0][0], queueName);
    t.deepEqual(JSON.parse(t.context.azureSBService.sendQueueMessage.args[0][1].body), message);

    t.context.azureSBService.sendQueueMessage.restore();
});

test.serial(`getMessage should return a message and don't delete it`, async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(null, [{ body: JSON.stringify(message) }]);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    const msg = await queue.getMessage();

    t.true(t.context.azureSBService.receiveQueueMessage.calledOnce);
    t.is(t.context.azureSBService.receiveQueueMessage.args[0][0], queueName);
    t.deepEqual(msg.data, message);

    t.context.azureSBService.receiveQueueMessage.restore();
});

test.serial(`if there is no messages in the queue, getMessage should return null`, async (t) => {
    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(new Error('No messages to receive'));
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    const msg = await queue.getMessage();

    t.true(t.context.azureSBService.receiveQueueMessage.calledOnce);
    t.is(t.context.azureSBService.receiveQueueMessage.args[0][0], queueName);
    t.is(msg, null);

    t.context.azureSBService.receiveQueueMessage.restore();
});

test.serial(`if there is another error, getMessage should return an error`, async (t) => {
    const errorMessage = 'Something went wrong';

    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(new Error(errorMessage));
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);
    try {
        await queue.getMessage();
    } catch (err) {
        t.is(err.message, errorMessage);
        t.true(t.context.azureSBService.receiveQueueMessage.calledOnce);
        t.is(t.context.azureSBService.receiveQueueMessage.args[0][0], queueName);
    }

    t.context.azureSBService.receiveQueueMessage.restore();
});
