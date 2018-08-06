import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const database = {
    serviceConfig: {
        activate() { },
        add() { },
        edit() { },
        get() { },
        getActive() { },
        getAll() { },
        remove() { }
    }
};

proxyquire('../../../../src/lib/microservices/config-manager/config-manager', { '../../common/database/database': database });

import * as configManager from '../../../../src/lib/microservices/config-manager/config-manager';
import { readFileAsync } from '../../../../src/lib/utils/misc';
import { ConfigData } from '../../../../src/lib/types';

test.beforeEach((t) => {
    sinon.stub(database.serviceConfig, 'add').resolves();
    sinon.stub(database.serviceConfig, 'activate').resolves();
    sinon.stub(database.serviceConfig, 'getAll').resolves();
    sinon.stub(database.serviceConfig, 'remove').resolves();
    sinon.stub(database.serviceConfig, 'edit').resolves();

    t.context.database = database;
});

test.afterEach.always((t) => {
    t.context.database.serviceConfig.add.restore();
    t.context.database.serviceConfig.activate.restore();
    t.context.database.serviceConfig.getAll.restore();
    t.context.database.serviceConfig.remove.restore();
    t.context.database.serviceConfig.edit.restore();
    if (t.context.database.serviceConfig.get.restore) {
        t.context.database.serviceConfig.get.restore();
    }
});

test.serial('add should create a new configuration in database', async (t) => {
    const configurationFromFile = JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config.json')));
    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    await configManager.add(configData);

    t.true(t.context.database.serviceConfig.add.called);
    t.deepEqual(t.context.database.serviceConfig.add.args[0][3], configurationFromFile);
});

test.serial('add should throw an error if the configuration file is invalid', async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-invalid.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.true(err.message.startsWith('Invalid Configuration'));
    }
});

test.serial('add should throw an error if the configuration has duplicate hints', async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-duplicates.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, 'Hint manifest-is-valid repeated');
    }
});

test.serial('add should throw an error if the configuration is not an array', async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, 'Configuration file has to contain an array of webhint configurations');
    }
});

test.serial(`add should throw an error if the name doesn't exist`, async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: null
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, `Field name can't be empty`);
    }
});

test.serial(`add should throw an error if the jobCacheTime doesn't exist`, async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: null,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, `Field jobCacheTime can't be empty`);
    }
});

test.serial(`add should throw an error if the jobRunTime doesn't exist`, async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: null,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, `Field jobRunTime can't be empty`);
    }
});

test.serial(`add should throw an error if the filePath doesn't exist`, async (t) => {
    t.plan(1);

    const configData: ConfigData = {
        filePath: null,
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.add(configData);
    } catch (err) {
        t.is(err.message, `Field filePath can't be empty`);
    }
});

test.serial('activate should activate the configuration in database with the given name', async (t) => {
    const name = 'configName';

    await configManager.activate(name);

    t.true(t.context.database.serviceConfig.activate.called);
    t.is(t.context.database.serviceConfig.activate.args[0][0], name);
});

test.serial('getAll should return a list of configurations', async (t) => {
    await configManager.list();

    t.true(t.context.database.serviceConfig.getAll.called);
});

test.serial('active should fail if there is no active configuration', async (t) => {
    sinon.stub(database.serviceConfig, 'getActive').resolves();
    t.plan(2);

    try {
        await configManager.active();
    } catch (err) {
        t.true(t.context.database.serviceConfig.getActive.called);
        t.is(err.message, 'There is no active configuration');
    }

    t.context.database.serviceConfig.getActive.restore();
});

test.serial('active should return a IServiceConfig object', async (t) => {
    sinon.stub(database.serviceConfig, 'getActive').resolves({
        active: true,
        field: 'value',
        jobCacheTime: 1,
        jobRunTime: 1,
        name: 'configName',
        webhintConfigs: [{}]
    });

    const fields = ['active', 'jobCacheTime', 'jobRunTime', 'name', 'webhintConfigs'];

    const config = await configManager.active();

    t.true(t.context.database.serviceConfig.getActive.called);

    const isIServiceConfig = Object.keys(config).every((key) => {
        return fields.includes(key);
    });

    t.true(isIServiceConfig);

    t.context.database.serviceConfig.getActive.restore();
});

test.serial('remove should throw an error if the config is active', async (t) => {
    sinon.stub(database.serviceConfig, 'get').resolves({ active: true });

    t.plan(2);
    try {
        await configManager.remove('config name');
    } catch (err) {
        t.is(err.message, 'Configuration is already active');
        t.true(t.context.database.serviceConfig.get.calledOnce);
    }
});

test.serial('remove should remove a configuration from the database', async (t) => {
    sinon.stub(database.serviceConfig, 'get').resolves({ active: false });

    await configManager.remove('config name');

    t.true(t.context.database.serviceConfig.get.calledOnce);
    t.true(t.context.database.serviceConfig.remove.calledOnce);
});

test.serial(`get should throw an error if the configuration doesn't exist in the database`, async (t) => {
    sinon.stub(database.serviceConfig, 'get').resolves(null);

    t.plan(2);
    try {
        await configManager.get('config name');
    } catch (err) {
        t.is(err.message, `The configuration config name doesn't exist`);
        t.true(t.context.database.serviceConfig.get.calledOnce);
    }
});

test.serial(`get should return a configuration`, async (t) => {
    const name = 'config name';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });

    const config = await configManager.get(name);

    t.is(config.name, name);
    t.true(t.context.database.serviceConfig.get.calledOnce);
});

test.serial(`edit should throw an error if the configuration doesn't exist in the database`, async (t) => {
    sinon.stub(database.serviceConfig, 'get').resolves(null);
    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    t.plan(2);
    try {
        await configManager.edit('config name', configData);
    } catch (err) {
        t.is(err.message, `The configuration config name doesn't exist`);
        t.true(t.context.database.serviceConfig.get.calledOnce);
    }
});

test.serial(`edit should throw an error if the name doesn't exist`, async (t) => {
    const name = 'oldName';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: null
    };

    try {
        await configManager.edit(name, configData);
    } catch (err) {
        t.is(err.message, `Field name can't be empty`);
    }
});

test.serial(`edit should throw an error if the jobCacheTime doesn't exist`, async (t) => {
    const name = 'oldName';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: null,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    try {
        await configManager.edit(name, configData);
    } catch (err) {
        t.is(err.message, `Field jobCacheTime can't be empty`);
    }
});

test.serial(`edit should throw an error if the jobRunTime doesn't exist`, async (t) => {
    const name = 'oldName';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });
    t.plan(1);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config-no-array.json',
        jobCacheTime: 120,
        jobRunTime: null,
        name: 'newConfiguration'
    };

    try {
        await configManager.edit(name, configData);
    } catch (err) {
        t.is(err.message, `Field jobRunTime can't be empty`);
    }
});

test.serial(`edit should edit the configuration`, async (t) => {
    const name = 'oldName';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config.json',
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.database.serviceConfig.edit.calledOnce);
});

test.serial(`edit should edit the configuration even if there is no filePath`, async (t) => {
    const name = 'oldName';

    sinon.stub(database.serviceConfig, 'get').resolves({ name });

    const configData: ConfigData = {
        filePath: null,
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.database.serviceConfig.edit.calledOnce);
    t.is(t.context.database.serviceConfig.edit.args[0][4], null);
});
