import * as fs from 'fs';

import test from 'ava';
import { EventEmitter2 as EventEmitter } from 'eventemitter2';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const resultsQueue = { sendMessage() { } };
const jobsQueue = { listen() { } };
const Queue = function () {
};

const queueObject = { Queue };

const childProcess = {
    ChildProcess() { },
    fork() { }
};

const ntp = {
    getTime() {
        Promise.resolve({ now: new Date() });
    }
};

proxyquire('../../../../src/lib/microservices/worker-service/worker-service', {
    '../../common/ntp/ntp': ntp,
    '../../common/queue/queue': queueObject,
    child_process: childProcess // eslint-disable-line camelcase
});

import * as worker from '../../../../src/lib/microservices/worker-service/worker-service';
import { JobStatus, RuleStatus } from '../../../../src/lib/enums/status';
import { delay } from '../../../../src/lib/utils/misc';

test.beforeEach((t) => {
    sinon.stub(queueObject, 'Queue')
        .onFirstCall()
        .returns(jobsQueue)
        .onSecondCall()
        .returns(resultsQueue);

    t.context.queueObject = queueObject;
    t.context.resultsQueue = resultsQueue;
    t.context.jobsQueue = jobsQueue;
    t.context.childProcess = childProcess;
});

test.afterEach((t) => {
    t.context.queueObject.Queue.restore();
    t.context.resultsQueue.sendMessage.restore();

    if (t.context.jobsQueue.listen.restore) {
        t.context.jobsQueue.listen.restore();
    }

    if (t.context.childProcess.fork.restore) {
        t.context.childProcess.fork.restore();
    }
});

test.serial('Worker has to listen the jobs queue', async (t) => {
    sinon.spy(resultsQueue, 'sendMessage');
    sinon.stub(jobsQueue, 'listen').resolves();

    await worker.run();

    t.true(t.context.jobsQueue.listen.calledOnce);
});

const getEmitter = () => {
    const emitter = new EventEmitter();

    (emitter as any).send = () => { };
    (emitter as any).kill = () => { };

    return emitter;
};

const commonStub = (emitter) => {
    sinon.stub(childProcess, 'fork').returns(emitter);

    sinon.stub(jobsQueue, 'listen');
};

const getRule = (name: string, rules) => {
    return rules.find((rule) => {
        return rule.name === name;
    });
};

test.serial(`If there is no problem running sonar, it should send a couple of messages with the current status`, async (t) => {
    const job = {
        config: [{ rules: { 'content-type': 'error' } }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [{
            category: 'interoperability',
            name: 'content-type',
            status: 'pending'
        }]
    };
    const emitter = getEmitter();

    sinon.spy(resultsQueue, 'sendMessage');

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [],
        ok: true
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(t.context.resultsQueue.sendMessage.args[1][0].status, JobStatus.finished);
});

test.serial(`If there is a problem running sonar, it should send a couple of messages with the current status`, async (t) => {
    const job = {
        config: [{}],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: []
    };
    const emitter = getEmitter();

    sinon.spy(resultsQueue, 'sendMessage');

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        error: '"Error running sonar"',
        ok: false
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(t.context.resultsQueue.sendMessage.args[1][0].status, JobStatus.error);
});

test.serial(`If there is a problem running sonar, the job sent to the queue has all rules in the configuration set as error`, async (t) => {
    const job = {
        config: [{
            rules: {
                axe: 'warning',
                'content-type': 'error',
                'disown-opener': ['off', {}]
            }
        }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [
            {
                name: 'axe',
                status: RuleStatus.pending
            },
            {
                name: 'content-type',
                status: RuleStatus.pending
            },
            {
                name: 'disown-opener',
                status: RuleStatus.pending
            },
            {
                name: 'manifest-exists',
                status: RuleStatus.pending
            }
        ]
    };
    const emitter = getEmitter();

    sinon.spy(resultsQueue, 'sendMessage');

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        error: '"Error running sonar"',
        ok: false
    });

    await promise;

    const jobSent = t.context.resultsQueue.sendMessage.args[1][0];
    const rules = jobSent.rules;
    const axe = getRule('axe', rules);
    const contentType = getRule('content-type', rules);
    const disown = getRule('disown-opener', rules);
    const manifest = getRule('manifest-exists', rules);

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(jobSent.status, JobStatus.error);
    t.is(axe.status, RuleStatus.error);
    t.is(contentType.status, RuleStatus.error);
    t.is(disown.status, RuleStatus.pass);
    t.is(manifest.status, RuleStatus.pending);
});

test.serial(`If a message is too big for Service Bus, we should send the rule with just one common error message`, async (t) => {
    const job = {
        config: [{
            rules: [
                'axe'
            ]
        }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [
            {
                name: 'axe',
                status: RuleStatus.pending
            },
            {
                name: 'content-type',
                status: RuleStatus.pending
            }
        ]
    };
    const emitter = getEmitter();

    t.plan(3);

    sinon.stub(resultsQueue, 'sendMessage')
        .onFirstCall()
        .resolves()
        .onSecondCall()
        .callsFake((j) => {
            // j.rules change in each call, so we need to test the value here for the second call.
            t.is(j.rules[0].messages.length, 2);

            const err = { statusCode: 413 };

            throw err;
        })
        .onThirdCall()
        .resolves();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [{
            message: 'First of a tons of messages',
            ruleId: 'axe'
        }, {
            message: 'Second of a tons of messages',
            ruleId: 'axe'
        }],
        ok: true
    });

    await promise;

    const jobSent = t.context.resultsQueue.sendMessage.args[2][0];

    t.is(t.context.resultsQueue.sendMessage.callCount, 3);
    t.is(jobSent.rules[0].messages.length, 1);
});

test.serial(`If there is no problem running sonar, it should send to the queue one message if the size is smaller than MAX_MESSAGE_SIZE`, async (t) => {
    const job = {
        config: [{
            rules: [
                'axe:warning',
                'content-type'
            ]
        }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [
            {
                name: 'axe',
                status: RuleStatus.pending
            },
            {
                name: 'content-type',
                status: RuleStatus.pending
            },
            {
                name: 'disown-opener',
                status: RuleStatus.pending
            }
        ]
    };
    const emitter = getEmitter();

    sinon.stub(resultsQueue, 'sendMessage')
        .onFirstCall()
        .resolves()
        .onSecondCall()
        .resolves();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [{
            message: 'Warning 1 axe',
            ruleId: 'axe'
        },
        {
            message: 'Warning 2 axe',
            ruleId: 'axe'
        }],
        ok: true
    });

    await promise;

    const axe = getRule('axe', t.context.resultsQueue.sendMessage.args[1][0].rules);
    const contentType = getRule('content-type', t.context.resultsQueue.sendMessage.args[1][0].rules);

    t.is(t.context.resultsQueue.sendMessage.callCount, 2);
    t.is(axe.status, RuleStatus.warning);
    t.is(contentType.status, RuleStatus.pass);
});

test.serial(`If there is no problem running sonar, it should send to the queue 2 messages if the total size is bigger than MAX_MESSAGE_SIZE`, async (t) => {
    const lipsum = fs.readFileSync(`${__dirname}/../fixtures/lipsum.txt`, 'utf-8'); // eslint-disable-line no-sync

    const job = {
        config: [{
            rules: [
                'axe:warning',
                'content-type'
            ]
        }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [
            {
                name: 'axe',
                status: RuleStatus.pending
            },
            {
                name: 'content-type',
                status: RuleStatus.pending
            }
        ]
    };
    const emitter = getEmitter();

    sinon.stub(resultsQueue, 'sendMessage')
        .onFirstCall()
        .resolves()
        .onSecondCall()
        .resolves();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [{
            message: lipsum,
            ruleId: 'axe'
        },
        {
            message: lipsum,
            ruleId: 'content-type'
        }],
        ok: true
    });

    await promise;

    t.is(t.context.resultsQueue.sendMessage.callCount, 3);
});


test.serial(`If there is no problem running sonar, it should send a "Too many errors" message if the messages are bigger than MAX_MESSAGE_SIZE`, async (t) => {
    const lipsum = fs.readFileSync(`${__dirname}/../fixtures/lipsum.txt`, 'utf-8'); // eslint-disable-line no-sync

    const job = {
        config: [{
            rules: [
                'axe:warning',
                'content-type'
            ]
        }],
        id: 0,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: [
            {
                name: 'axe',
                status: RuleStatus.pending
            },
            {
                name: 'content-type',
                status: RuleStatus.pending
            }
        ]
    };
    const emitter = getEmitter();

    sinon.stub(resultsQueue, 'sendMessage')
        .onFirstCall()
        .resolves();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0]([job]);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [{
            message: lipsum + lipsum,
            ruleId: 'axe'
        }],
        ok: true
    });

    await promise;

    const axe = getRule('axe', t.context.resultsQueue.sendMessage.args[1][0].rules);

    t.is(t.context.resultsQueue.sendMessage.callCount, 2);
    t.is(axe.status, RuleStatus.warning);
    t.is(axe.messages.length, 1);
    t.is(axe.messages[0].message, 'This rule has too many errors, please use sonar locally for more details');
});


test.serial(`If sonar doesn't finish before the job.maxRunTime, it should report an error message to the queue, but the job status is finished`, async (t) => {
    const job = {
        config: [{}],
        id: 0,
        maxRunTime: 1,
        partInfo: {
            part: 1,
            totalParts: 5
        },
        rules: []
    };
    const emitter = getEmitter();

    sinon.spy(resultsQueue, 'sendMessage');

    commonStub(emitter);

    await worker.run();
    await t.context.jobsQueue.listen.args[0][0]([job]);

    t.true(t.context.resultsQueue.sendMessage.calledTwice);

    const queueArgs = t.context.resultsQueue.sendMessage.args[1][0];

    t.is(queueArgs.status, JobStatus.finished);
    t.is(queueArgs.error.message, 'TIMEOUT');
});
