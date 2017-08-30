import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const mongoose = { connect() { } };

const dbLock = {
    acquire(callback) {
        callback(null, 'code');
    },
    ensureIndexes() { },
    release() { }
};

const mongoDBLock = () => {
    return dbLock;
};

const query = { exec() { } };

const jobObject = { save() { } };

const Job: any = function () {
    return jobObject;
};

Job.find = () => { };
Job.findOne = () => { };

const models = { Job };

proxyquire('../../../../src/lib/common/database/database', {
    './models/job': models,
    'mongodb-lock': mongoDBLock,
    mongoose
});

import * as database from '../../../../src/lib/common/database/database';
import { IJob } from '../../../../src/lib/types/job'; // eslint-disable-line no-unused-vars
import { JobStatus } from '../../../../src/lib/enums/status'; // eslint-disable-line no-unused-vars

const jobResult: Array<IJob> = [{
    config: null,
    error: null,
    finished: new Date(),
    queued: new Date(),
    rules: null,
    started: new Date(),
    status: JobStatus.pending,
    url: 'url'
}];

test.beforeEach((t) => {
    sinon.stub(Job, 'find').returns(query);
    sinon.stub(Job, 'findOne').returns(query);

    t.context.mongoose = mongoose;
    t.context.dbLock = dbLock;
    t.context.Job = Job;
    t.context.query = query;
});

test.afterEach.always((t) => {
    if (t.context.mongoose.connect.restore) {
        t.context.mongoose.connect.restore();
    }

    if (t.context.dbLock.ensureIndexes.restore) {
        t.context.dbLock.ensureIndexes.restore();
    }

    t.context.Job.find.restore();
    t.context.Job.findOne.restore();
});

test.serial('unlock should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('lock should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getJobsByUrl should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getJobsByUrl('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getJob should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getJob('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('newJob should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.newJob('url', JobStatus.pending, [], []);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});


test.serial('unlock should call to releaseAsync', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    const lock = { releaseAsync() { } };

     // We need to be connected to the database before lock it
    await database.connect('conectionString');

    t.context.lock = lock;
    sinon.stub(lock, 'releaseAsync').resolves([]);

    await database.unlock(lock);

    t.true(t.context.lock.releaseAsync.calledOnce);

    t.context.lock.releaseAsync.restore();
});

test.serial('connect should connect to mongoose and create an index', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    await database.connect('conectionString');

    t.true(t.context.mongoose.connect.calledOnce);
    t.true(t.context.dbLock.ensureIndexes.calledOnce);
});

test.serial('if connect fail, it should throw an error', async (t) => {
    const errorMessage = 'error connecting';

    sinon.stub(mongoose, 'connect').rejects(new Error(errorMessage));
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    t.plan(3);
    try {
        await database.connect('conectionString');
    } catch (err) {
        t.is(err.message, errorMessage);
        t.true(t.context.mongoose.connect.calledOnce);
        t.false(t.context.dbLock.ensureIndexes.called);
    }
});

test.serial('if ensureIndexes fail, it should throw an error', async (t) => {
    const errorMessage = 'error connecting';

    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArgWith(0, errorMessage);

    t.plan(3);
    try {
        await database.connect('conectionString');
    } catch (err) {
        t.is(err, errorMessage);
        t.true(t.context.mongoose.connect.calledOnce);
        t.true(t.context.dbLock.ensureIndexes.calledOnce);
    }
});

test.serial('lock should lock the database', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(dbLock, 'acquire').callsFake((callback) => {
        callback(null, 'code');
    });

    const lock = await database.lock('url');

    t.true(lock.acquire.calledOnce);

    t.context.dbLock.acquireAsync.restore();
});

test.serial('if database is locked, it should retry to lock the database', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(dbLock, 'acquire')
        .onFirstCall()
        .callsFake((callback) => {
            callback(null, null);
        })
        .onSecondCall()
        .callsFake((callback) => {
            callback(null, 'code');
        });

    const lock = await database.lock('url');

    t.true(lock.acquire.calledTwice);

    t.context.dbLock.acquireAsync.restore();
});

test.serial('if database is locked for a long time, it should throw an error', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(dbLock, 'acquire')
        .callsFake((callback) => {
            callback(null, null);
        });

    try {
        await database.lock('url');
    } catch (err) {
        t.is(t.context.dbLock.acquire.callCount, 10);
        t.is(err.message, 'Lock not acquired');
    }

    t.context.dbLock.acquireAsync.restore();
});

test.serial('getJobsByUrl should return a job', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(query, 'exec').resolves(jobResult);

    const result = await database.getJobsByUrl('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(result, jobResult);

    t.context.query.exec.restore();
});

test.serial('getJob should return a job', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(query, 'exec').resolves(jobResult[0]);

    const result = await database.getJob('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.findOne.calledOnce);
    t.is(result, jobResult[0]);

    t.context.query.exec.restore();
});

test.serial('newJob should return save a new job in database', async (t) => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');

    sinon.stub(jobObject, 'save').resolves();

    t.context.jobObject = jobObject;

    await database.newJob('url', JobStatus.pending, null, null);

    t.true(t.context.jobObject.save.calledOnce);

    t.context.jobObject.save.restore();
});
