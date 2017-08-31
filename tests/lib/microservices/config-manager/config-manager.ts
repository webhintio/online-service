import * as path from 'path';

import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const database = {
    activateConfiguration() { },
    getActiveConfiguration() { },
    listConfigurations() { },
    newConfig() { }
};

proxyquire('../../../../src/lib/microservices/config-manager/config-manager', { '../../common/database/database': database });

import * as configManager from '../../../../src/lib/microservices/config-manager/config-manager';
import { readFileAsync } from '../../../../src/lib/utils/misc';

test.beforeEach((t) => {
    sinon.stub(database, 'newConfig').resolves();
    sinon.stub(database, 'activateConfiguration').resolves();
    sinon.stub(database, 'listConfigurations').resolves();

    t.context.database = database;
});

test.afterEach.always((t) => {
    t.context.database.newConfig.restore();
    t.context.database.activateConfiguration.restore();
    t.context.database.listConfigurations.restore();
});

test.serial('createNewConfiguration should create a new configuration in database', async (t) => {
    const configurationFromFile = JSON.parse(await readFileAsync(path.join(__dirname, './fixtures/.sonarrc')));

    await configManager.createNewConfiguration('newConfiguration', 120, 180, 'dist/tests/lib/microservices/config-manager/fixtures/.sonarrc');

    t.true(t.context.database.newConfig.called);
    t.deepEqual(t.context.database.newConfig.args[0][3], configurationFromFile);
});

test.serial('createNewConfiguration should throw an error if the configuration file is invalid', async (t) => {
    t.plan(1);

    try {
        await configManager.createNewConfiguration('newConfiguration', 120, 180, 'dist/tests/lib/microservices/config-manager/fixtures/.sonarrcInvalid');
    } catch (err) {
        t.is(err.message, 'Invalid Configuration file');
    }
});


test.serial('activateConfiguration should activate the configuration in database with the given name', async (t) => {
    const name = 'configName';

    await configManager.activateConfiguration(name);

    t.true(t.context.database.activateConfiguration.called);
    t.is(t.context.database.activateConfiguration.args[0][0], name);
});

test.serial('listConfigurations should return a list of configurations', async (t) => {
    await configManager.listConfigurations();

    t.true(t.context.database.listConfigurations.called);
});

test.serial('getActiveConfiguration should fail if there is no active configuration', async (t) => {
    sinon.stub(database, 'getActiveConfiguration').resolves();
    t.plan(2);

    try {
        await configManager.getActiveConfiguration();
    } catch (err) {
        t.true(t.context.database.getActiveConfiguration.called);
        t.is(err.message, 'There is no active configuration');
    }

    t.context.database.getActiveConfiguration.restore();
});

test.serial('getActiveConfiguration should return a IServiceConfig object', async (t) => {
    sinon.stub(database, 'getActiveConfiguration').resolves({
        active: true,
        field: 'value',
        jobCacheTime: 1,
        jobRunTime: 1,
        name: 'configName',
        sonarConfig: {}
    });

    const fields = ['active', 'jobCacheTime', 'jobRunTime', 'name', 'sonarConfig'];

    const config = await configManager.getActiveConfiguration();

    t.true(t.context.database.getActiveConfiguration.called);

    const isIServiceConfig = Object.keys(config).every((key) => {
        return fields.includes(key);
    });

    t.true(isIServiceConfig);

    t.context.database.getActiveConfiguration.restore();
});
