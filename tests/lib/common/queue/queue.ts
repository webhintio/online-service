import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

type AzureSBService = {
    deleteMessage: (param1: any, callback: any) => void;
    getQueue: (param1: any, callback: any) => void;
    receiveQueueMessage: (param1: any, param2: any, callback: any) => void;
    sendQueueMessage: (param1: any, param2: any, callback: any) => void;
    unlockMessage: () => void;
};

const azureSBService: AzureSBService = {
    deleteMessage() { },
    getQueue() { },
    receiveQueueMessage() { },
    sendQueueMessage() { },
    unlockMessage() { }
};

const azureSB = {
    createServiceBusService(): AzureSBService {
        return azureSBService;
    }
};

const misc = { delay() { } };

proxyquire('../../../../src/lib/common/queue/queue', {
    '../../utils/misc': misc,
    'azure-sb': azureSB
});

import { Queue } from '../../../../src/lib/common/queue/queue';

test.beforeEach((t) => {
    sinon.spy(misc, 'delay');
    sinon.stub(azureSB, 'createServiceBusService').returns(azureSBService);

    t.context.azureSB = azureSB;
    t.context.misc = misc;
});

test.afterEach.always((t) => {
    t.context.azureSB.createServiceBusService.restore();
    t.context.misc.delay.restore();
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

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    await queue.sendMessage(message);

    t.true(t.context.azureSBService.sendQueueMessage.calledOnce);
    t.is(t.context.azureSBService.sendQueueMessage.args[0][0], queueName);
    t.deepEqual(JSON.parse(t.context.azureSBService.sendQueueMessage.args[0][1].body), message);

    t.context.azureSBService.sendQueueMessage.restore();
});

test.serial('if sendMessage fails, it should retry it', async (t) => {
    sinon.stub(azureSBService, 'sendQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback({});
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null);
        });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    await queue.sendMessage(message);

    t.true(t.context.azureSBService.sendQueueMessage.calledTwice);

    t.context.azureSBService.sendQueueMessage.restore();
});

test.serial('if sendMessage fails always, it should return an error', async (t) => {
    const error = new Error('error');

    sinon.stub(azureSBService, 'sendQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(error);
        });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    t.plan(2);

    try {
        await queue.sendMessage(message);
    } catch (err) {
        t.is(t.context.azureSBService.sendQueueMessage.callCount, 10);
        t.is(err, error);
    }
    t.context.azureSBService.sendQueueMessage.restore();
});

test.serial(`getMessage should return a message and don't delete it`, async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(null, { body: JSON.stringify(message) });
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    const msg = await queue.getMessage();

    t.true(t.context.azureSBService.receiveQueueMessage.calledOnce);
    t.is(t.context.azureSBService.receiveQueueMessage.args[0][0], queueName);
    t.true(t.context.azureSBService.receiveQueueMessage.args[0][1].isPeekLock);
    t.deepEqual(msg.data, message);

    t.context.azureSBService.receiveQueueMessage.restore();
});

test.serial(`if there is no messages in the queue, getMessage should return null`, async (t) => {
    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback('No messages to receive');
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
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

    const queueName = 'queueName';
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

test.serial('getMessagesCount should return the number of active messages in the queue', async (t) => {
    const queueResult = { CountDetails: { 'd2p1:ActiveMessageCount': 15 } };

    sinon.stub(azureSBService, 'getQueue').callsFake((param1, callback) => {
        callback(null, queueResult);
    });

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    const result = await queue.getMessagesCount();

    t.is(result, queueResult.CountDetails['d2p1:ActiveMessageCount']);
});

test.serial(`if listen is called without handler, it should return an error`, async (t) => {
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(1);
    try {
        await queue.listen(null);
    } catch (err) {
        t.is(err.message, 'Listen needs a handler to work');
    }
});

test.serial(`if a listener is called twice without stop it before, it should return an error`, async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(null, { body: JSON.stringify(message) });
    });

    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(1);

    await queue.listen(async () => {
        try {
            await queue.listen(() => {
                return true;
            });
        } catch (err) {
            t.is(err.message, 'There is already a listener defined. Stop the previous one');
        } finally {
            queue.stopListener();
        }
    });

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial('if listen is call with the option pooling defined, it should use it as default value', async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    }, { pooling: 3 });

    t.is(t.context.misc.delay.args[0][0], 3);
    t.true(t.context.azureSBService.deleteMessage.calledOnce);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial(`if listen is call with the autoDeleteMessages to false, it shouldn't delete messages`, async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    sinon.spy(azureSBService, 'deleteMessage');

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    }, { autoDeleteMessages: false });

    t.false(t.context.azureSBService.deleteMessage.called);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial('the lisener should receive an array with as many messages as the option messagesToGet', async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);

    await queue.listen((messages) => {
        t.is(messages.length, 3);
        queue.stopListener();
    }, { messagesToGet: 3 });

    t.is(t.context.azureSBService.deleteMessage.callCount, 3);
    t.is(t.context.azureSBService.receiveQueueMessage.callCount, 3);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial('the lisener should receive an array with as many messages as the option messagesToGet or messages in the queue', async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        });
    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);

    await queue.listen((messages) => {
        t.is(messages.length, 1);
        queue.stopListener();
    }, { messagesToGet: 3 });

    t.is(t.context.azureSBService.deleteMessage.callCount, 1);
    t.is(t.context.azureSBService.receiveQueueMessage.callCount, 2);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial('if service bus returns an error 503, delay should be called with 10000', async (t) => {
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback({ statusCode: 503 });
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    });

    t.is(t.context.misc.delay.args[0][0], 10000);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});

test.serial(`if the handler throws an error, then the message shouldn't be deleted`, async (t) => {
    // In the online-service, the only case for the handler to fail is
    // if something goes wrong with the queue.
    const message = { id: 'id', url: 'url' };

    sinon.stub(azureSBService, 'receiveQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

    t.context.azureSBService = azureSBService;

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    let firstCall = true;

    await queue.listen(() => {
        if (firstCall) {
            firstCall = false;
            throw new Error();
        }

        queue.stopListener();
    });

    t.true(t.context.azureSBService.deleteMessage.calledOnce);

    t.context.azureSBService.receiveQueueMessage.restore();
    t.context.azureSBService.deleteMessage.restore();
});
