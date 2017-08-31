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

proxyquire('../../../../src/lib/microservices/worker-service/worker-service', {
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

    sinon.spy(resultsQueue, 'sendMessage');

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

test.serial(`If there is no problem running sonar, it should send a couple of messages with the current status`, async (t) => {
    const job = {
        config: {},
        id: 0,
        rules: []
    };
    const emitter = getEmitter();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0](job);

    await delay(500);
    await emitter.emitAsync('message', {
        messages: [],
        ok: true
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(t.context.resultsQueue.sendMessage.args[1][0].status, JobStatus.finished);
});

test.serial(`If there is no problem running sonar, it should send a couple of messages with the current status`, async (t) => {
    const job = {
        config: {},
        id: 0,
        rules: []
    };
    const emitter = getEmitter();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0](job);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        error: 'Error running sonar',
        ok: false
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(t.context.resultsQueue.sendMessage.args[1][0].status, JobStatus.error);
});

test.serial(`If there is no problem running sonar, it should send a couple of messages with the current status`, async (t) => {
    const job = {
        config: {},
        id: 0,
        rules: []
    };
    const emitter = getEmitter();

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0](job);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        error: 'Error running sonar',
        ok: false
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);
    t.is(t.context.resultsQueue.sendMessage.args[1][0].status, JobStatus.error);
});

const getRule = (name: string, rules) => {
    return rules.find((rule) => {
        return rule.name === name;
    });
};

test.serial(`If there is no problem running sonar, it should send to the queue the status of each configured rule`, async (t) => {
    const job = {
        config: {
            rules: [
                'axe:warning',
                'content-type'
            ]
        },
        id: 0,
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

    commonStub(emitter);

    await worker.run();

    const promise = t.context.jobsQueue.listen.args[0][0](job);

    // Wait a little bit to ensure that 'runSonar' was launched
    await delay(500);
    await emitter.emitAsync('message', {
        messages: [{
            message: 'Error 1 axe',
            ruleId: 'axe'
        },
        {
            message: 'Error 2 axe',
            ruleId: 'axe'
        }],
        ok: true
    });

    await promise;

    t.true(t.context.resultsQueue.sendMessage.calledTwice);

    const sendedRules = t.context.resultsQueue.sendMessage.args[1][0].rules;

    const axe = getRule('axe', sendedRules);
    const contentType = getRule('content-type', sendedRules);
    const disown = getRule('disown-opener', sendedRules);

    t.is(axe.status, RuleStatus.error);
    t.is(contentType.status, RuleStatus.pass);
    t.is(disown.status, RuleStatus.pending);
});
