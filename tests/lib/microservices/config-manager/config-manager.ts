import * as path from 'path';

import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

import { ConfigData, IServiceConfig } from '../../../../src/lib/types';

const database = {
    serviceConfig: {
        activate() { },
        add() { },
        edit() { },
        get(): Promise<IServiceConfig> {
            return null;
        },
        getActive(): Promise<IServiceConfig> {
            return null;
        },
        getAll() { },
        remove() { }
    }
};

type ConfigTestContext = {
    sandbox: sinon.SinonSandbox;
    databaseServiceConfigAddStub: sinon.SinonStub;
    databaseServiceConfigActivateStub: sinon.SinonStub;
    databaseServiceConfigGetAllStub: sinon.SinonStub;
    databaseServiceConfigRemoveStub: sinon.SinonStub;
    databaseServiceConfigEditStub: sinon.SinonStub;
    databaseServiceConfigGetStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<ConfigTestContext>;

proxyquire('../../../../src/lib/microservices/config-manager/config-manager', { '../../common/database/database': database });

import * as configManager from '../../../../src/lib/microservices/config-manager/config-manager';
import { readFileAsync } from '../../../../src/lib/utils/misc';


test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.databaseServiceConfigAddStub = sandbox.stub(database.serviceConfig, 'add').resolves();
    t.context.databaseServiceConfigActivateStub = sandbox.stub(database.serviceConfig, 'activate').resolves();
    t.context.databaseServiceConfigGetAllStub = sandbox.stub(database.serviceConfig, 'getAll').resolves();
    t.context.databaseServiceConfigRemoveStub = sandbox.stub(database.serviceConfig, 'remove').resolves();
    t.context.databaseServiceConfigEditStub = sandbox.stub(database.serviceConfig, 'edit').resolves();

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('add should create a new configuration in database', async (t: TestContext) => {
    const configurationFromFile = JSON.parse(await readFileAsync(path.join(__dirname, '../fixtures/config.json')));
    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config.json',
        jobCacheTime: 120,
        jobRunTime: 180,
        name: 'newConfiguration'
    };

    await configManager.add(configData);

    t.true(t.context.databaseServiceConfigAddStub.called);
    t.deepEqual(t.context.databaseServiceConfigAddStub.args[0][3], configurationFromFile);
});

test.serial('add should throw an error if the configuration file is invalid', async (t: TestContext) => {
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

test.serial('add should throw an error if the configuration has duplicate hints', async (t: TestContext) => {
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

test.serial('add should throw an error if the configuration is not an array', async (t: TestContext) => {
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

test.serial(`add should throw an error if the name doesn't exist`, async (t: TestContext) => {
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

test.serial(`add should throw an error if the jobCacheTime doesn't exist`, async (t: TestContext) => {
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

test.serial(`add should throw an error if the jobRunTime doesn't exist`, async (t: TestContext) => {
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

test.serial(`add should throw an error if the filePath doesn't exist`, async (t: TestContext) => {
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

test.serial('activate should activate the configuration in database with the given name', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'configName';

    await configManager.activate(name);

    t.true(t.context.databaseServiceConfigActivateStub.called);
    t.is(t.context.databaseServiceConfigActivateStub.args[0][0], name);
});

test.serial('getAll should return a list of configurations', async (t: TestContext) => {
    await configManager.list();

    t.true(t.context.databaseServiceConfigGetAllStub.called);
});

test.serial('active should fail if there is no active configuration', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const databaseServiceconfigGetActiveStub = sandbox.stub(database.serviceConfig, 'getActive').resolves();

    t.plan(2);

    try {
        await configManager.active();
    } catch (err) {
        t.true(databaseServiceconfigGetActiveStub.called);
        t.is(err.message, 'There is no active configuration');
    }

    databaseServiceconfigGetActiveStub.restore();
});

test.serial('active should return a IServiceConfig object', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const databaseServiceconfigGetActiveStub = sandbox.stub(database.serviceConfig, 'getActive').resolves({
        active: true,
        jobCacheTime: 1,
        jobRunTime: 1,
        name: 'configName',
        webhintConfigs: [{}]
    });

    const fields = ['active', 'jobCacheTime', 'jobRunTime', 'name', 'webhintConfigs'];

    const config = await configManager.active();

    t.true(databaseServiceconfigGetActiveStub.called);

    const isIServiceConfig = Object.keys(config).every((key) => {
        return fields.includes(key);
    });

    t.true(isIServiceConfig);

    databaseServiceconfigGetActiveStub.restore();
});

test.serial('remove should throw an error if the config is active', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ active: true } as IServiceConfig);

    t.plan(2);
    try {
        await configManager.remove('config name');
    } catch (err) {
        t.is(err.message, 'Configuration is already active');
        t.true(t.context.databaseServiceConfigGetStub.calledOnce);
    }
});

test.serial('remove should remove a configuration from the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ active: false } as IServiceConfig);

    await configManager.remove('config name');

    t.true(t.context.databaseServiceConfigGetStub.calledOnce);
    t.true(t.context.databaseServiceConfigRemoveStub.calledOnce);
});

test.serial(`get should throw an error if the configuration doesn't exist in the database`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves(null);

    t.plan(2);
    try {
        await configManager.get('config name');
    } catch (err) {
        t.is(err.message, `The configuration config name doesn't exist`);
        t.true(t.context.databaseServiceConfigGetStub.calledOnce);
    }
});

test.serial(`get should return a configuration`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'config name';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);

    const config = await configManager.get(name);

    t.is(config.name, name);
    t.true(t.context.databaseServiceConfigGetStub.calledOnce);
});

test.serial(`edit should throw an error if the configuration doesn't exist in the database`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;


    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves(null);
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
        t.true(t.context.databaseServiceConfigGetStub.calledOnce);
    }
});

test.serial(`edit should throw an error if the name doesn't exist`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'oldName';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);
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

test.serial(`edit should throw an error if the jobCacheTime doesn't exist`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'oldName';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);
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

test.serial(`edit should throw an error if the jobRunTime doesn't exist`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'oldName';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);
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

test.serial(`edit should edit the configuration`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'oldName';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);

    const configData: ConfigData = {
        filePath: 'dist/tests/lib/microservices/fixtures/config.json',
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.databaseServiceConfigEditStub.calledOnce);
});

test.serial(`edit should edit the configuration even if there is no filePath`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'oldName';

    t.context.databaseServiceConfigGetStub = sandbox.stub(database.serviceConfig, 'get').resolves({ name } as IServiceConfig);

    const configData: ConfigData = {
        filePath: null,
        jobCacheTime: 120,
        jobRunTime: 100,
        name: 'newConfiguration'
    };

    await configManager.edit(name, configData);

    t.true(t.context.databaseServiceConfigEditStub.calledOnce);
    t.is(t.context.databaseServiceConfigEditStub.args[0][4], null);
});
