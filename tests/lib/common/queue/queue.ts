import test, { ExecutionContext } from 'ava';
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

type QueueTestContext = {
    sandbox: sinon.SinonSandbox;
    azureSBCreateServiceBusServiceStub: sinon.SinonStub;
    miscDelaySpy: sinon.SinonSpy;
};

type TestContext = ExecutionContext<QueueTestContext>;

proxyquire('../../../../src/lib/common/queue/queue', {
    '../../utils/misc': misc,
    'azure-sb': azureSB
});

import { Queue } from '../../../../src/lib/common/queue/queue';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.miscDelaySpy = sandbox.spy(misc, 'delay');
    t.context.azureSBCreateServiceBusServiceStub = sandbox.stub(azureSB, 'createServiceBusService').returns(azureSBService);

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('Constructor should create the instance of azure service bus', (t: TestContext) => {
    const queue = new Queue('QueueName', 'connectionString'); // eslint-disable-line no-unused-vars

    t.true(t.context.azureSBCreateServiceBusServiceStub.calledOnce);
});

test.serial('sendMessage should send a message to service bus', async (t: TestContext) => {
    const azureSBServiceSendQueueMessageStub = sinon.stub(azureSBService, 'sendQueueMessage').callsFake((param1, param2, callback) => {
        callback(null);
    });

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    await queue.sendMessage(message);

    t.true(azureSBServiceSendQueueMessageStub.calledOnce);
    t.is(azureSBServiceSendQueueMessageStub.args[0][0], queueName);
    t.deepEqual(JSON.parse(azureSBServiceSendQueueMessageStub.args[0][1].body), message);

    azureSBServiceSendQueueMessageStub.restore();
});

test.serial('if sendMessage fails, it should retry it', async (t: TestContext) => {
    const azureSBServiceSendQueueMessageStub = sinon.stub(azureSBService, 'sendQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback({});
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null);
        });

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    await queue.sendMessage(message);

    t.true(azureSBServiceSendQueueMessageStub.calledTwice);

    azureSBServiceSendQueueMessageStub.restore();
});

test.serial('if sendMessage fails always, it should return an error', async (t: TestContext) => {
    const error = new Error('error');

    const azureSBServiceSendQueueMessageStub = sinon.stub(azureSBService, 'sendQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(error);
        });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');
    const message = { id: 'id', url: 'url' };

    t.plan(2);

    try {
        await queue.sendMessage(message);
    } catch (err) {
        t.is(azureSBServiceSendQueueMessageStub.callCount, 10);
        t.is(err, error);
    }
    azureSBServiceSendQueueMessageStub.restore();
});

test.serial(`getMessage should return a message and don't delete it`, async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(null, { body: JSON.stringify(message) });
    });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    const msg = await queue.getMessage();

    t.true(azureSBServiceReceiveQueueMessageStub.calledOnce);
    t.is(azureSBServiceReceiveQueueMessageStub.args[0][0], queueName);
    t.true(azureSBServiceReceiveQueueMessageStub.args[0][1].isPeekLock);
    t.deepEqual(msg.data, message);

    azureSBServiceReceiveQueueMessageStub.restore();
});

test.serial(`if there is no messages in the queue, getMessage should return null`, async (t: TestContext) => {
    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback('No messages to receive');
    });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    const msg = await queue.getMessage();

    t.true(azureSBServiceReceiveQueueMessageStub.calledOnce);
    t.is(azureSBServiceReceiveQueueMessageStub.args[0][0], queueName);
    t.is(msg, null);

    azureSBServiceReceiveQueueMessageStub.restore();
});

test.serial(`if there is another error, getMessage should return an error`, async (t: TestContext) => {
    const errorMessage = 'Something went wrong';

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(new Error(errorMessage));
    });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);
    try {
        await queue.getMessage();
    } catch (err) {
        t.is(err.message, errorMessage);
        t.true(azureSBServiceReceiveQueueMessageStub.calledOnce);
        t.is(azureSBServiceReceiveQueueMessageStub.args[0][0], queueName);
    }

    azureSBServiceReceiveQueueMessageStub.restore();
});

test.serial('getMessagesCount should return the number of active messages in the queue', async (t: TestContext) => {
    const queueResult = { CountDetails: { 'd2p1:ActiveMessageCount': 15 } };

    sinon.stub(azureSBService, 'getQueue').callsFake((param1, callback) => {
        callback(null, queueResult);
    });

    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    const result = await queue.getMessagesCount();

    t.is(result, queueResult.CountDetails['d2p1:ActiveMessageCount']);
});

test.serial(`if listen is called without handler, it should return an error`, async (t: TestContext) => {
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(1);
    try {
        await queue.listen(null);
    } catch (err) {
        t.is(err.message, 'Listen needs a handler to work');
    }
});

test.serial(`if a listener is called twice without stop it before, it should return an error`, async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage').callsFake((param1, param2, callback) => {
        callback(null, { body: JSON.stringify(message) });
    });

    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });

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

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});

test.serial('if listen is call with the option pooling defined, it should use it as default value', async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    }, { pooling: 3 });

    t.is(t.context.miscDelaySpy.args[0][0], 3);
    t.true(azureSBServiceDeleteMessageStub.calledOnce);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});

test.serial(`if listen is call with the autoDeleteMessages to false, it shouldn't delete messages`, async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    const azureSBServiceDeleteMessageSpy = sinon.spy(azureSBService, 'deleteMessage');
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    }, { autoDeleteMessages: false });

    t.false(azureSBServiceDeleteMessageSpy.called);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageSpy.restore();
});

test.serial('the lisener should receive an array with as many messages as the option messagesToGet', async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });
    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);

    await queue.listen((messages) => {
        t.is(messages.length, 3);
        queue.stopListener();
    }, { messagesToGet: 3 });

    t.is(azureSBServiceDeleteMessageStub.callCount, 3);
    t.is(azureSBServiceReceiveQueueMessageStub.callCount, 3);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});

test.serial('the lisener should receive an array with as many messages as the option messagesToGet or messages in the queue', async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback('No messages to receive');
        });
    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });
    const queueName = 'queueNme';
    const queue = new Queue(queueName, 'connectionString');

    t.plan(3);

    await queue.listen((messages) => {
        t.is(messages.length, 1);
        queue.stopListener();
    }, { messagesToGet: 3 });

    t.is(azureSBServiceDeleteMessageStub.callCount, 1);
    t.is(azureSBServiceReceiveQueueMessageStub.callCount, 2);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});

test.serial('if service bus returns an error 503, delay should be called with 10000', async (t: TestContext) => {
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .onFirstCall()
        .callsFake((param1, param2, callback) => {
            callback({ statusCode: 503 });
        })
        .onSecondCall()
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });
    const queueName = 'queueName';
    const queue = new Queue(queueName, 'connectionString');

    await queue.listen(() => {
        queue.stopListener();
    });

    t.is(t.context.miscDelaySpy.args[0][0], 10000);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});

test.serial(`if the handler throws an error, then the message shouldn't be deleted`, async (t: TestContext) => {
    // In the online-service, the only case for the handler to fail is
    // if something goes wrong with the queue.
    const message = { id: 'id', url: 'url' };

    const azureSBServiceReceiveQueueMessageStub = sinon.stub(azureSBService, 'receiveQueueMessage')
        .callsFake((param1, param2, callback) => {
            callback(null, { body: JSON.stringify(message) });
        });
    const azureSBServiceDeleteMessageStub = sinon.stub(azureSBService, 'deleteMessage').callsFake((param1, callback) => {
        callback(null);
    });
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

    t.true(azureSBServiceDeleteMessageStub.calledOnce);

    azureSBServiceReceiveQueueMessageStub.restore();
    azureSBServiceDeleteMessageStub.restore();
});
