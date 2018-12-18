import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { UserConfig } from 'hint/dist/src/lib/types';

const common = {
    validateConnection(): boolean {
        return false;
    }
};

type Query = {
    exec: () => Query;
    remove: () => Query;
};

const query: Query = {
    exec(): Query {
        return query;
    },
    remove(): Query {
        return query;
    }
};

const modelObject = { save() { } };

const ServiceConfig: any = function () {
    return modelObject;
};

ServiceConfig.find = () => { };
ServiceConfig.findOne = () => { };

const serviceConfigModels = { ServiceConfig };

const error = new Error('Database not connected');

type DBServiceConfigTestContext = {
    sandbox: sinon.SinonSandbox;
    serviceConfigFindStub: sinon.SinonStub;
    serviceConfigFindOneStub: sinon.SinonStub;
    queryRemoveStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<DBServiceConfigTestContext>;

proxyquire('../../../../src/lib/common/database/methods/serviceconfig', {
    '../models/serviceconfig': serviceConfigModels,
    './common': common
});

import * as serviceConfig from '../../../../src/lib/common/database/methods/serviceconfig';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.serviceConfigFindStub = sandbox.stub(ServiceConfig, 'find').returns(query);
    t.context.serviceConfigFindOneStub = sandbox.stub(ServiceConfig, 'findOne').returns(query);

    t.context.queryRemoveStub = sandbox.stub(query, 'remove').returns(query);

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('serviceConfig.add should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.add('configName', 120, 180, [{}] as Array<UserConfig>);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.activate should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.activate('configName');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.getAll  should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.getAll();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.getActive should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.getActive();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.get should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.get('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.remove should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.remove('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.edit should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await serviceConfig.edit('name', 'newName', 100, 100, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('serviceConfig.add should save a new configuration in database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const modelObjectSaveStub = sandbox.stub(modelObject, 'save').resolves();

    await serviceConfig.add('configName', 120, 180, [{}] as Array<UserConfig>);

    t.true(modelObjectSaveStub.calledOnce);
});

test.serial('serviceConfig.activate should return an error if there is no data in the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'configName';

    sandbox.stub(query, 'exec').resolves([]);

    t.plan(1);
    try {
        await serviceConfig.activate(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }
});

test.serial('serviceConfig.activate should return an error if there is no configuration with the given name', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'configName';

    sandbox.stub(query, 'exec').resolves([{ name: 'otherName' }]);

    t.plan(1);
    try {
        await serviceConfig.activate(name);
    } catch (err) {
        t.is(err.message, `Configuration '${name}' doesn't exist`);
    }
});

test.serial('serviceConfig.activate should activate the configuration with the given name', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const name = 'configName';
    const modelFunctions = { save() { } };

    const modelFunctionsSaveStub = sandbox.stub(modelFunctions, 'save').resolves();

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

    sandbox.stub(query, 'exec').resolves(configurations);

    await serviceConfig.activate(name);

    t.is(modelFunctionsSaveStub.callCount, 3);
    t.true(configurations[0].active);
    t.false(configurations[1].active);
    t.false(configurations[2].active);
});

test.serial('serviceConfig.getAll should returns a list of configurations', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const configurations = [
        { name: 'config0' },
        { name: 'config1' },
        { name: 'config2' }
    ];

    sandbox.stub(query, 'exec').resolves(configurations);

    const list = await serviceConfig.getAll();

    t.is(list, configurations);
});

test.serial('serviceConfig.get should return a configuration', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const config = { name: 'config' };

    const queryExecStub = sandbox.stub(query, 'exec').resolves(config);

    const result = await serviceConfig.get('config');

    t.true(queryExecStub.calledOnce);
    t.true(t.context.serviceConfigFindOneStub.calledOnce);
    t.is(result, config);
});

test.serial('serviceConfig.remove should remove a configuration', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await serviceConfig.remove('config');

    t.true(queryExecStub.calledOnce);
    t.true(t.context.queryRemoveStub.calledOnce);
    t.true(t.context.serviceConfigFindOneStub.calledOnce);
});

test.serial('serviceConfig.getActive should return the active configuration', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await serviceConfig.getActive();

    t.true(queryExecStub.calledOnce);
    t.true(t.context.serviceConfigFindOneStub.calledOnce);
    t.true(t.context.serviceConfigFindOneStub.args[0][0].active);
});

test.serial(`serviceConfig.edit shouldn't modify the webhintConfigs property if config is null`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const config = {
        jobCacheTime: 1,
        jobRunTime: 1,
        markModified() { },
        name: 'oldName',
        save() { },
        webhintConfigs: {}
    };
    const configMarkModifiedSpy = sandbox.spy(config, 'markModified');

    sandbox.stub(query, 'exec').resolves(config);

    const result = await serviceConfig.edit('oldName', 'newName', 100, 200);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.webhintConfigs, config.webhintConfigs);
    t.false(configMarkModifiedSpy.called);
});

test.serial(`serviceConfig.edit should modify the webhintConfigs property if config isn't null`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const config = {
        jobCacheTime: 1,
        jobRunTime: 1,
        markModified(param: string) { },
        name: 'oldName',
        save() { },
        webhintConfigs: {}
    };
    const webhintConfigs: Array<UserConfig> = [{
        connector: {
            name: 'jsdom',
            options: {}
        }
    }];
    const configMarkModifiedSpy = sandbox.spy(config, 'markModified');

    sandbox.stub(query, 'exec').resolves(config);

    const result = await serviceConfig.edit('oldName', 'newName', 100, 200, webhintConfigs);

    t.is(result.name, 'newName');
    t.is(result.jobCacheTime, 100);
    t.is(result.jobRunTime, 200);
    t.is(result.webhintConfigs, webhintConfigs);
    t.true(configMarkModifiedSpy.calledOnce);
    t.is(configMarkModifiedSpy.args[0][0], 'webhintConfigs');
});
