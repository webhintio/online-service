import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const database = {
    activateConfiguration() { },
    editConfiguration() { },
    getActiveConfiguration() { },
    getConfigurationByName() { },
    listConfigurations() { },
    newConfig() { },
    removeConfiguration() { }
};

proxyquire('../../../../src/lib/microservices/config-manager/config-manager', { '../../common/database/database': database });

import * as configManager from '../../../../src/lib/microservices/config-manager/config-manager';
import { readFileAsync } from '../../../../src/lib/utils/misc';
import { ConfigData } from '../../../../src/lib/types';

test.beforeEach((t) => {
    sinon.stub(database, 'newConfig').resolves();
    sinon.stub(database, 'activateConfiguration').resolves();
    sinon.stub(database, 'listConfigurations').resolves();
    sinon.stub(database, 'removeConfiguration').resolves();
    sinon.stub(database, 'editConfiguration').resolves();

    t.context.database = database;
});

test.afterEach.always((t) => {
    t.context.database.newConfig.restore();
    t.context.database.activateConfiguration.restore();
    t.context.database.listConfigurations.restore();
    t.context.database.removeConfiguration.restore();
    t.context.database.editConfiguration.restore();
    if (t.context.database.getConfigurationByName.restore) {
        t.context.database.getConfigurationByName.restore();
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

    t.true(t.context.database.newConfig.called);
    t.deepEqual(t.context.database.newConfig.args[0][3], configurationFromFile);
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

test.serial('add should throw an error if the configuration has duplicate rules', async (t) => {
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
        t.is(err.message, 'Rule manifest-is-valid repeated');
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
        t.is(err.message, 'Configuration file has to container an array of sonar configurations');
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

    t.true(t.context.database.activateConfiguration.called);
    t.is(t.context.database.activateConfiguration.args[0][0], name);
});

test.serial('listConfigurations should return a list of configurations', async (t) => {
    await configManager.list();

    t.true(t.context.database.listConfigurations.called);
});

test.serial('active should fail if there is no active configuration', async (t) => {
    sinon.stub(database, 'getActiveConfiguration').resolves();
    t.plan(2);

    try {
        await configManager.active();
    } catch (err) {
        t.true(t.context.database.getActiveConfiguration.called);
        t.is(err.message, 'There is no active configuration');
    }

    t.context.database.getActiveConfiguration.restore();
});

test.serial('active should return a IServiceConfig object', async (t) => {
    sinon.stub(database, 'getActiveConfiguration').resolves({
        active: true,
        field: 'value',
        jobCacheTime: 1,
        jobRunTime: 1,
        name: 'configName',
        sonarConfigs: {}
    });

    const fields = ['active', 'jobCacheTime', 'jobRunTime', 'name', 'sonarConfigs'];

    const config = await configManager.active();

    t.true(t.context.database.getActiveConfiguration.called);

    const isIServiceConfig = Object.keys(config).every((key) => {
        return fields.includes(key);
    });

    t.true(isIServiceConfig);

    t.context.database.getActiveConfiguration.restore();
});

test.serial('remove should throw an error if the config is active', async (t) => {
    sinon.stub(database, 'getConfigurationByName').resolves({ active: true });

    t.plan(2);
    try {
        await configManager.remove('config name');
    } catch (err) {
        t.is(err.message, 'Configuration is already active');
        t.true(t.context.database.getConfigurationByName.calledOnce);
    }
});

test.serial('remove should remove a configuration from the database', async (t) => {
    sinon.stub(database, 'getConfigurationByName').resolves({ active: false });

    await configManager.remove('config name');

    t.true(t.context.database.getConfigurationByName.calledOnce);
    t.true(t.context.database.removeConfiguration.calledOnce);
});

test.serial(`get should throw an error if the configuration doesn't exist in the database`, async (t) => {
    sinon.stub(database, 'getConfigurationByName').resolves(null);

    t.plan(2);
    try {
        await configManager.get('config name');
    } catch (err) {
        t.is(err.message, `The configuration config name doesn't exist`);
        t.true(t.context.database.getConfigurationByName.calledOnce);
    }
});

test.serial(`get should return a configuration`, async (t) => {
    const name = 'config name';

    sinon.stub(database, 'getConfigurationByName').resolves({ name });

    const config = await configManager.get(name);

    t.is(config.name, name);
    t.true(t.context.database.getConfigurationByName.calledOnce);
});

test.serial(`edit should throw an error if the configuration doesn't exist in the database`, async (t) => {
    sinon.stub(database, 'getConfigurationByName').resolves(null);
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
        t.true(t.context.database.getConfigurationByName.calledOnce);
    }
});

test.serial(`edit should throw an error if the name doesn't exist`, async (t) => {
    const name = 'oldName';

    sinon.stub(database, 'getConfigurationByName').resolves({ name });
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

    sinon.stub(database, 'getConfigurationByName').resolves({ name });
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

    sinon.stub(database, 'getConfigurationByName').resolves({ name });
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

    sinon.stub(database, 'getConfigurationByName').resolves({ name });

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config.json',
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.database.editConfiguration.calledOnce);
});

test.serial(`edit should edit the configuration even if there is no filePath`, async (t) => {
    const name = 'oldName';

    sinon.stub(database, 'getConfigurationByName').resolves({ name });

    const configData: ConfigData = {
        filePath: null,
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.database.editConfiguration.calledOnce);
    t.is(t.context.database.editConfiguration.args[0][4], null);
});
