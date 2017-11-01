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

const query = {
    count() { },
    exec() { },
    remove() { }
};

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

const User: any = function () {
    return modelObject;
};

User.find = () => { };
User.findOne = () => { };

const userModels = { User };

proxyquire('../../../../src/lib/common/database/database', {
    './models/job': jobModels,
    './models/serviceconfig': serviceConfigModels,
    './models/user': userModels,
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
    sinon.stub(User, 'find').returns(query);
    sinon.stub(User, 'findOne').returns(query);
    sinon.stub(query, 'remove').returns(query);
    sinon.stub(query, 'count').returns(query);

    t.context.mongoose = mongoose;
    t.context.ServiceConfig = ServiceConfig;
    t.context.dbLock = dbLock;
    t.context.Job = Job;
    t.context.query = query;
    t.context.User = User;
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

    t.context.query.remove.restore();
    t.context.query.count.restore();
    t.context.Job.find.restore();
    t.context.Job.findOne.restore();
    t.context.ServiceConfig.find.restore();
    t.context.ServiceConfig.findOne.restore();
    t.context.User.find.restore();
    t.context.User.findOne.restore();
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
        await database.newJob('url', JobStatus.pending, [], [{}] as Array<IConfig>, 180);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('newConfig should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.newConfig('configName', 120, 180, [{}] as Array<IConfig>);
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

test.serial('getConfigurationByName should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getConfigurationByName('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('removeConfiguration should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.removeConfiguration('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('editConfiguration should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.editConfiguration('name', 'newName', 100, 100, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('addUser should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.addUser('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getUserByName should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getUserByName('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('removeUserByName should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.removeUserByName('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getStatusCount should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getStatusCount(JobStatus.error);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('getJobsCount should fail if database is not connected', async (t) => {
    t.plan(1);
    try {
        await database.getJobsCount();
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

    await database.newConfig('configName', 120, 180, [{}] as Array<IConfig>);

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

test.serial('getConfigurationByName should return a configuration', async (t) => {
    await connectDatabase();
    const config = { name: 'config' };

    sinon.stub(query, 'exec').resolves(config);

    const result = await database.getConfigurationByName('config');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);
    t.is(result, config);

    t.context.query.exec.restore();
});

test.serial('removeConfiguration should remove a configuration', async (t) => {
    await connectDatabase();

    sinon.stub(query, 'exec').resolves();

    await database.removeConfiguration('config');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.query.remove.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);

    t.context.query.exec.restore();
});

test.serial('getActiveConfiguration should return the active configuration', async (t) => {
    await connectDatabase();

    sinon.stub(query, 'exec').resolves();

    await database.getActiveConfiguration();

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);
    t.true(t.context.ServiceConfig.findOne.args[0][0].active);

    t.context.query.exec.restore();
});

test.serial(`editConfiguration shouldn't modify the sonarConfigs property if config is null`, async (t) => {
    await connectDatabase();
    const config = {
        jobCacheTime: 1,
        jobRunTime: 1,
        markModified() { },
        name: 'oldName',
        save() { },
        sonarConfigs: {}
    };

    t.context.config = config;

    sinon.spy(config, 'markModified');
    sinon.stub(query, 'exec').resolves(config);

    const result = await database.editConfiguration('oldName', 'newName', 100, 200);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.sonarConfigs, config.sonarConfigs);
    t.false(t.context.config.markModified.called);

    t.context.config.markModified.restore();
    t.context.query.exec.restore();
});

test.serial(`editConfiguration should modify the sonarConfigs property if config isn't null`, async (t) => {
    await connectDatabase();
    const config = {
        jobCacheTime: 1,
        jobRunTime: 1,
        markModified() { },
        name: 'oldName',
        save() { },
        sonarConfigs: {}
    };

    const sonarConfigs: Array<IConfig> = [{
        connector: {
            name: 'jsdom',
            options: {}
        }
    }];

    t.context.config = config;

    sinon.spy(config, 'markModified');
    sinon.stub(query, 'exec').resolves(config);

    const result = await database.editConfiguration('oldName', 'newName', 100, 200, sonarConfigs);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.sonarConfigs, sonarConfigs);
    t.true(t.context.config.markModified.calledOnce);
    t.is(t.context.config.markModified.args[0][0], 'sonarConfigs');

    t.context.config.markModified.restore();
    t.context.query.exec.restore();
});

test.serial('newUser should save a new user in database', async (t) => {
    await connectDatabase();

    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await database.addUser('userName');

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('getUsers should return all users in the database', async (t) => {
    await connectDatabase();

    sinon.stub(query, 'exec').resolves();

    await database.getUsers();

    t.deepEqual(t.context.User.find.args[0][0], {});
    t.true(t.context.User.find.calledOnce);

    t.context.query.exec.restore();
});

test.serial('getUserByName should return an user', async (t) => {
    const name = 'userName';

    await connectDatabase();

    sinon.stub(query, 'exec').resolves();

    await database.getUserByName(name);

    t.deepEqual(t.context.User.findOne.args[0][0].name, name);
    t.true(t.context.User.findOne.calledOnce);

    t.context.query.exec.restore();
});

test.serial('removeUser should remove an user from the database', async (t) => {
    const name = 'userName';

    await connectDatabase();

    sinon.stub(query, 'exec').resolves();

    await database.removeUserByName(name);

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.query.remove.calledOnce);
    t.true(t.context.User.findOne.calledOnce);
    t.is(t.context.User.findOne.args[0][0].name, name);

    t.context.query.exec.restore();
});

test.serial('getStatusCount should return the number of jobs with that status', async (t) => {
    sinon.stub(query, 'exec').resolves();

    await database.getStatusCount(JobStatus.error);

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].status, JobStatus.error);

    t.context.query.exec.restore();
});

test.serial('getStatusCount with a since parameter should return the number of jobs since that date with that status', async (t) => {
    sinon.stub(query, 'exec').resolves();

    const since = new Date();

    await database.getStatusCount(JobStatus.error, {
        field: 'finished',
        since
    });

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].status, JobStatus.error);
    t.is(t.context.Job.find.args[0][0].finished.$gte, since);

    t.context.query.exec.restore();
});

test.serial('getJobsCount should return the number of jobs in the database', async (t) => {
    sinon.stub(query, 'exec').resolves();

    await database.getJobsCount();

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.deepEqual(t.context.Job.find.args[0][0], {});

    t.context.query.exec.restore();
});

test.serial('getJobsCount with a since parameter should return the number of jobs since that date', async (t) => {
    sinon.stub(query, 'exec').resolves();

    const since = new Date();

    await database.getJobsCount({ since });

    t.true(t.context.query.count.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Job.find.calledOnce);
    t.is(t.context.Job.find.args[0][0].finished.$gte, since);

    t.context.query.exec.restore();
});

test.serial('disconnect should call to mongoose.disconnect', async (t) => {
    await connectDatabase();

    sinon.stub(mongoose, 'disconnect').resolves();

    database.disconnect();

    t.true(t.context.mongoose.disconnect.called);
});
