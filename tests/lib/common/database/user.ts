import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const common = { validateConnection() { } };

type Query = {
    exec: () => Query;
    remove: () => Query;
};


const query: Query = {
    exec() {
        return query;
    },
    remove() {
        return query;
    }
};

const modelObject = { save() { } };

const User: any = function () {
    return modelObject;
};

User.find = () => { };
User.findOne = () => { };

const userModels = { User };
const error = new Error('Database not connected');

type DBUserTestContext = {
    sandbox: sinon.SinonSandbox;
    userFindStub: sinon.SinonStub;
    userFindOneStub: sinon.SinonStub;
    queryRemoveStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<DBUserTestContext>;

proxyquire('../../../../src/lib/common/database/methods/user', {
    '../models/user': userModels,
    './common': common
});

import * as user from '../../../../src/lib/common/database/methods/user';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.userFindStub = sandbox.stub(User, 'find').returns(query);
    t.context.userFindOneStub = sandbox.stub(User, 'findOne').returns(query);
    t.context.queryRemoveStub = sandbox.stub(query, 'remove').returns(query);

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('user.add should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.add('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.get should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.get('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.remove should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.remove('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.add should save a new user in database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const modelObjectSaveStub = sandbox.stub(modelObject, 'save').resolves();

    await user.add('userName');

    t.true(modelObjectSaveStub.calledOnce);
});

test.serial('user.getAll should return all users in the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(query, 'exec').resolves();

    await user.getAll();

    t.deepEqual(t.context.userFindStub.args[0][0], {});
    t.true(t.context.userFindStub.calledOnce);
});

test.serial('user.get should return an user', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const name = 'userName';

    sandbox.stub(query, 'exec').resolves();

    await user.get(name);

    t.deepEqual(t.context.userFindOneStub.args[0][0].name, name);
    t.true(t.context.userFindOneStub.calledOnce);
});

test.serial('user.remove should remove an user from the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const name = 'userName';

    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await user.remove(name);

    t.true(queryExecStub.calledOnce);
    t.true(t.context.queryRemoveStub.calledOnce);
    t.true(t.context.userFindOneStub.calledOnce);
    t.is(t.context.userFindOneStub.args[0][0].name, name);
});
