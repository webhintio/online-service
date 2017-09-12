import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { IConfig } from '@sonarwhal/sonar/dist/src/lib/types';

const mongoose = {
    connect() { },
    disconnect() { }
};

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

const modelObject = { save() { } };

const Job: any = function () {
    return modelObject;
};

Job.find = () => { };
Job.findOne = () => { };

const jobModels = { Job };

const ServiceConfig: any = function () {
    return modelObject;
};

ServiceConfig.find = () => { };
ServiceConfig.findOne = () => { };

const serviceConfigModels = { ServiceConfig };

proxyquire('../../../../src/lib/common/database/database', {
    './models/job': jobModels,
    './models/serviceconfig': serviceConfigModels,
    'mongodb-lock': mongoDBLock,
    mongoose
});

import * as database from '../../../../src/lib/common/database/database';
import { IJob } from '../../../../src/lib/types';
import { JobStatus } from '../../../../src/lib/enums/status';

const jobResult: Array<IJob> = [{
    config: null,
    error: null,
    finished: new Date(),
    maxRunTime: 180,
    queued: new Date(),
    rules: null,
    sonarVersion: null,
    started: new Date(),
    status: JobStatus.pending,
    url: 'url'
}];

const connectDatabase = async () => {
    sinon.stub(mongoose, 'connect').resolves({});
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await database.connect('connectionString');
};

test.beforeEach((t) => {
    sinon.stub(Job, 'find').returns(query);
    sinon.stub(Job, 'findOne').returns(query);
    sinon.stub(ServiceConfig, 'find').returns(query);
    sinon.stub(ServiceConfig, 'findOne').returns(query);

    t.context.mongoose = mongoose;
    t.context.ServiceConfig = ServiceConfig;
    t.context.dbLock = dbLock;
    t.context.Job = Job;
    t.context.query = query;
});

test.afterEach.always((t) => {
    if (t.context.mongoose.connect.restore) {
        t.context.mongoose.connect.restore();
    }

    if (t.context.mongoose.disconnect.restore) {
        t.context.mongoose.disconnect.restore();
    }

    if (t.context.dbLock.ensureIndexes.restore) {
        t.context.dbLock.ensureIndexes.restore();
    }

    t.context.Job.find.restore();
    t.context.Job.findOne.restore();
    t.context.ServiceConfig.find.restore();
    t.context.ServiceConfig.findOne.restore();
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
        await database.newJob('url', JobStatus.pending, [], {} as IConfig, 180);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('newConfig should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.newConfig('configName', 120, 180, {} as IConfig);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('activateConfiguration should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.activateConfiguration('configName');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('listConfigurations  should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.listConfigurations();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getActiveConfiguration should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getActiveConfiguration();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('disconnect should do nothing if database is not connected', async (t) => {
    sinon.spy(mongoose, 'disconnect');

    await database.disconnect();

    t.false(t.context.mongoose.disconnect.called);
});

test.serial('unlock should call to releaseAsync', async (t) => {
    const lock = { releaseAsync() { } };

    await connectDatabase();

    t.context.lock = lock;
    sinon.stub(lock, 'releaseAsync').resolves([]);

    await database.unlock(lock);

    t.true(t.context.lock.releaseAsync.calledOnce);

    t.context.lock.releaseAsync.restore();
});

test.serial('connect should connect to mongoose and create an index', async (t) => {
    await connectDatabase();

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
    await connectDatabase();

    sinon.stub(dbLock, 'acquire').callsFake((callback) => {
        callback(null, 'code');
    });

    const lock = await database.lock('url');

    t.true(lock.acquire.calledOnce);

    t.context.dbLock.acquireAsync.restore();
});

test.serial('if database is locked, it should retry to lock the database', async (t) => {
    await connectDatabase();

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
    await connectDatabase();

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
    await connectDatabase();

    sinon.stub(query, 'exec').resolves(jobResult);

    const result = await database.getJobsByUrl('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(result, jobResult);

    t.context.query.exec.restore();
});

test.serial('getJob should return a job', async (t) => {
    await connectDatabase();

    sinon.stub(query, 'exec').resolves(jobResult[0]);

    const result = await database.getJob('url');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.findOne.calledOnce);
    t.is(result, jobResult[0]);

    t.context.query.exec.restore();
});

test.serial('newJob should save a new job in database', async (t) => {
    await connectDatabase();

    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await database.newJob('url', JobStatus.pending, null, null, 180);

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('newConfig should save a new configuration in database', async (t) => {
    await connectDatabase();

    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await database.newConfig('configName', 120, 180, {} as IConfig);

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('activateConfiguration should return an error if there is no data in the database', async (t) => {
    const name = 'configName';

    await connectDatabase();

    sinon.stub(query, 'exec').resolves([]);

    t.plan(1);
    try {
        await database.activateConfiguration(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }

    t.context.query.exec.restore();
});

test.serial('activateConfiguration should return an error if there is no configuration with the given name', async (t) => {
    const name = 'configName';

    await connectDatabase();

    sinon.stub(query, 'exec').resolves([{ name: 'otherName' }]);

    t.plan(1);
    try {
        await database.activateConfiguration(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }

    t.context.query.exec.restore();
});

test.serial('activateConfiguration should activate the configuration with the given name', async (t) => {
    const name = 'configName';
    const modelFunctions = { save() { } };

    sinon.stub(modelFunctions, 'save').resolves();

    const configurations = [{
        active: null,
        name,
        save: modelFunctions.save
    }, {
        active: null,
        name: 'config1',
        save: modelFunctions.save
    },
    {
        active: null,
        name: 'config2',
        save: modelFunctions.save
    }];

    t.context.modelFunctions = modelFunctions;

    await connectDatabase();

    sinon.stub(query, 'exec').resolves(configurations);

    await database.activateConfiguration(name);

    t.is(t.context.modelFunctions.save.callCount, 3);
    t.true(configurations[0].active);
    t.false(configurations[1].active);
    t.false(configurations[2].active);

    t.context.modelFunctions.save.restore();
    t.context.query.exec.restore();
});

test.serial('listConfigurations should returns a list of configurations', async (t) => {
    const configurations = [{ name: 'config0' },
    { name: 'config1' },
    { name: 'config2' }];

    await connectDatabase();

    sinon.stub(query, 'exec').resolves(configurations);

    const list = await database.listConfigurations();

    t.is(list, configurations);

    t.context.query.exec.restore();
});

test.serial('disconnect should call to mongoose.disconnect', async (t) => {
    await connectDatabase();

    sinon.stub(mongoose, 'disconnect').resolves();

    database.disconnect();

    t.true(t.context.mongoose.disconnect.called);
});
