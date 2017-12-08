import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { IConfig } from 'sonarwhal/dist/src/lib/types';

const common = { validateConnection() { } };

const query = {
    exec() { },
    remove() { }
};

const modelObject = { save() { } };

const ServiceConfig: any = function () {
    return modelObject;
};

ServiceConfig.find = () => { };
ServiceConfig.findOne = () => { };

const serviceConfigModels = { ServiceConfig };

const error = new Error('Database not connected');

proxyquire('../../../../src/lib/common/database/methods/serviceconfig', {
    '../models/serviceconfig': serviceConfigModels,
    './common': common
});

import * as serviceConfig from '../../../../src/lib/common/database/methods/serviceconfig';

test.beforeEach((t) => {
    sinon.stub(ServiceConfig, 'find').returns(query);
    sinon.stub(ServiceConfig, 'findOne').returns(query);

    sinon.stub(query, 'remove').returns(query);

    t.context.ServiceConfig = ServiceConfig;
    t.context.query = query;
    t.context.common = common;
});

test.afterEach.always((t) => {
    t.context.query.remove.restore();
    t.context.ServiceConfig.find.restore();
    t.context.ServiceConfig.findOne.restore();

    if (t.context.common.validateConnection.restore) {
        t.context.common.validateConnection.restore();
    }
});

test.serial('serviceConfig.add should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.add('configName', 120, 180, [{}] as Array<IConfig>);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.activate should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.activate('configName');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.getAll  should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.getAll();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.getActive should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.getActive();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.get should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.get('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.remove should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.remove('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.edit should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.edit('name', 'newName', 100, 100, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.add should save a new configuration in database', async (t) => {
    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await serviceConfig.add('configName', 120, 180, [{}] as Array<IConfig>);

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('serviceConfig.activate should return an error if there is no data in the database', async (t) => {
    const name = 'configName';

    sinon.stub(query, 'exec').resolves([]);

    t.plan(1);
    try {
        await serviceConfig.activate(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }

    t.context.query.exec.restore();
});

test.serial('serviceConfig.activate should return an error if there is no configuration with the given name', async (t) => {
    const name = 'configName';

    sinon.stub(query, 'exec').resolves([{ name: 'otherName' }]);

    t.plan(1);
    try {
        await serviceConfig.activate(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }

    t.context.query.exec.restore();
});

test.serial('serviceConfig.activate should activate the configuration with the given name', async (t) => {
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

    sinon.stub(query, 'exec').resolves(configurations);

    await serviceConfig.activate(name);

    t.is(t.context.modelFunctions.save.callCount, 3);
    t.true(configurations[0].active);
    t.false(configurations[1].active);
    t.false(configurations[2].active);

    t.context.modelFunctions.save.restore();
    t.context.query.exec.restore();
});

test.serial('serviceConfig.getAll should returns a list of configurations', async (t) => {
    const configurations = [{ name: 'config0' },
    { name: 'config1' },
    { name: 'config2' }];

    sinon.stub(query, 'exec').resolves(configurations);

    const list = await serviceConfig.getAll();

    t.is(list, configurations);

    t.context.query.exec.restore();
});

test.serial('serviceConfig.get should return a configuration', async (t) => {
    const config = { name: 'config' };

    sinon.stub(query, 'exec').resolves(config);

    const result = await serviceConfig.get('config');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);
    t.is(result, config);

    t.context.query.exec.restore();
});

test.serial('serviceConfig.remove should remove a configuration', async (t) => {
    sinon.stub(query, 'exec').resolves();

    await serviceConfig.remove('config');

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.query.remove.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);

    t.context.query.exec.restore();
});

test.serial('serviceConfig.getActive should return the active configuration', async (t) => {
    sinon.stub(query, 'exec').resolves();

    await serviceConfig.getActive();

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.ServiceConfig.findOne.calledOnce);
    t.true(t.context.ServiceConfig.findOne.args[0][0].active);

    t.context.query.exec.restore();
});

test.serial(`serviceConfig.edit shouldn't modify the sonarConfigs property if config is null`, async (t) => {
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

    const result = await serviceConfig.edit('oldName', 'newName', 100, 200);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.sonarConfigs, config.sonarConfigs);
    t.false(t.context.config.markModified.called);

    t.context.config.markModified.restore();
    t.context.query.exec.restore();
});

test.serial(`serviceConfig.edit should modify the sonarConfigs property if config isn't null`, async (t) => {
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

    const result = await serviceConfig.edit('oldName', 'newName', 100, 200, sonarConfigs);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.sonarConfigs, sonarConfigs);
    t.true(t.context.config.markModified.calledOnce);
    t.is(t.context.config.markModified.args[0][0], 'sonarConfigs');

    t.context.config.markModified.restore();
    t.context.query.exec.restore();
});
