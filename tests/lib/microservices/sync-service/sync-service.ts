import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as path from 'path';

import { readFile, readFileAsync } from '../../../../src/lib/utils/misc';
import { JobStatus, RuleStatus } from '../../../../src/lib/enums/status';
import { IJob } from '../../../../src/lib/types';

const logger = { error() { } };
const resultsQueue = { listen() { } };
const Queue = function () {
};
const queueObject = { Queue };
const database = {
    connect() { },
    job: {
        get() { },
        update() { }
    },
    unlock() { }
};

const data = {
    error: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'error.json'))),
    finished: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'finished.json'))),
    finishedPart1: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'finished-part1.json'))),
    finishedPart2: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'finished-part2.json'))),
    finishedWithError: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'finished-with-error.json'))),
    started: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'started.json'))),
    startedNewId: JSON.parse(readFile(path.join(__dirname, 'fixtures', 'started-new-id.json')))
};

proxyquire('../../../../src/lib/microservices/sync-service/sync-service', {
    '../../common/database/database': database,
    '../../common/queue/queue': queueObject,
    '../../utils/logging': logger
});

import * as sync from '../../../../src/lib/microservices/sync-service/sync-service';

test.beforeEach(async (t) => {
    sinon.stub(queueObject, 'Queue').returns(resultsQueue);
    sinon.stub(database, 'connect').resolves();
    sinon.stub(resultsQueue, 'listen').resolves();
    sinon.stub(database, 'lock').resolves();
    sinon.stub(database, 'unlock').resolves();
    sinon.stub(database.job, 'update').resolves();

    t.context.job = JSON.parse(await readFileAsync(path.join(__dirname, 'fixtures', 'dbdata.json')));

    t.context.resultsQueue = resultsQueue;
    t.context.database = database;
    t.context.logger = logger;
    t.context.queueObject = queueObject;
});

test.afterEach.always((t) => {
    t.context.database.connect.restore();
    t.context.queueObject.Queue.restore();
    t.context.resultsQueue.listen.restore();
    t.context.database.lock.restore();
    t.context.database.unlock.restore();
    t.context.database.job.update.restore();
    t.context.database.job.get.restore();
});

test.serial(`if a job doesn't exists in database, it should report an error and unlock the key`, async (t) => {
    sinon.stub(database.job, 'get').resolves();
    sinon.spy(logger, 'error');

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    t.true(t.context.logger.error.calledOnce);
    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.false(t.context.database.job.update.called);

    t.context.logger.error.restore();
});

test.serial(`if the job in the database has the status 'error', it should work as normal`, async (t) => {
    t.context.job.status = JobStatus.error;
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);
});

test.serial(`if the job status is 'started' and the job status is database 'pending', it should update the status and the started property`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);
    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.started);
    t.is(dbJob.started, data.started.started);
});

test.serial(`if the job status is 'started' and the job status in database is not 'pending', it should update just the started property`, async (t) => {
    t.context.job.status = JobStatus.finished;
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);
    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.finished);
    t.is(dbJob.started, data.started.started);
});

test.serial(`if the job status is 'started' and the property started in database is greater than the current one, it should update the started property`, async (t) => {
    t.context.job.status = JobStatus.finished;
    t.context.job.started = new Date('2017-08-31T23:55:00.877Z');
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);
    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.finished);
    t.is(dbJob.started, data.started.started);
});

test.serial(`if the job status is 'error', it should update the job in database properly`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.error]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);
    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.not(dbJob.status, JobStatus.error);
    t.is(dbJob.finished, data.error.finished);
    t.deepEqual(dbJob.error[0], data.error.error);
});

test.serial(`if the job status is 'finished' and all rules are processed, it should update rules and send the status finished if there is no errors`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.finished]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);

    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.finished);
    t.is(dbJob.finished, data.finished.finished);

    for (const rule of dbJob.rules) {
        t.not(rule.status, RuleStatus.pending);
    }
});

test.serial(`if the job status is 'finished' and all rules are processed, it should update rules and send the status error if there is a previous error in database`, async (t) => {
    t.context.job.error = [data.error.error];
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.finished]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);

    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.error);
    t.is(dbJob.finished, data.finished.finished);

    for (const rule of dbJob.rules) {
        t.not(rule.status, RuleStatus.pending);
    }
});

test.serial(`if the job status is 'finished' and all rules are processed, it should update rules and send the status error if there is any error`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.finishedWithError]);

    t.true(t.context.database.lock.calledOnce);
    t.true(t.context.database.unlock.calledOnce);
    t.true(t.context.database.job.update.called);

    const dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.error);
    t.is(dbJob.finished, data.finished.finished);

    for (const rule of dbJob.rules) {
        t.not(rule.status, RuleStatus.pending);
    }
});

test.serial(`if the job status is 'finished' but they are partial results, it should update rules and just send the status finished when all the rules are processed`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started]);

    let dbJob: IJob = t.context.database.job.update.args[0][0];

    t.is(dbJob.status, JobStatus.started);
    t.is(dbJob.started, data.started.started);

    await t.context.resultsQueue.listen.args[0][0]([data.finishedPart1]);

    dbJob = t.context.database.job.update.args[1][0];

    t.is(dbJob.status, JobStatus.started);

    await t.context.resultsQueue.listen.args[0][0]([data.finishedPart2]);

    dbJob = t.context.database.job.update.args[2][0];

    t.is(dbJob.status, JobStatus.finished);
    t.truthy(dbJob.finished);

    t.is(t.context.database.lock.callCount, 3);
    t.is(t.context.database.unlock.callCount, 3);
    t.is(t.context.database.job.update.callCount, 3);
});

test.serial(`if the job receive more than one message from the same id, it should lock the database just once`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started, data.finishedPart1, data.finishedPart2]);

    t.is(t.context.database.lock.callCount, 1);
    t.is(t.context.database.unlock.callCount, 1);
    t.is(t.context.database.job.update.callCount, 1);
});

test.serial(`if the job receive two messages with different id, it should lock the database twice`, async (t) => {
    sinon.stub(database.job, 'get').resolves(t.context.job);

    await sync.run();

    await t.context.resultsQueue.listen.args[0][0]([data.started, data.startedNewId]);

    t.is(t.context.database.lock.callCount, 2);
    t.is(t.context.database.unlock.callCount, 2);
    t.is(t.context.database.job.update.callCount, 2);
});
