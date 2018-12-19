import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

import { IStatus } from '../../../../src/lib/types';

const common = {
    validateConnection(): boolean {
        return false;
    }
};

type Query = {
    exec: () => Query;
    sort: () => Query;
};

const query: Query = {
    exec() {
        return query;
    },
    sort() {
        return query;
    }
};

const modelObject = { save() { } };

const Status: any = function () {
    return modelObject;
};

Status.findOne = () => { };

const statusModels = { Status };
const error = new Error('Database not connected');

proxyquire('../../../../src/lib/common/database/methods/status', {
    '../models/status': statusModels,
    './common': common
});

type DBStatusTestContext = {
    sandbox: sinon.SinonSandbox;
    statusFindOneStub: sinon.SinonStub;
    querySortStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<DBStatusTestContext>;

import * as status from '../../../../src/lib/common/database/methods/status';

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    t.context.statusFindOneStub = sandbox.stub(Status, 'findOne').returns(query);
    t.context.querySortStub = sandbox.stub(query, 'sort').returns(query);

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('status.add should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.add(null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.update should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.update(null, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.getMostRecent should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.getMostRecent();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.getByDate should fail if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.getByDate(null, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.add should create a new status in database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const modelObjectSaveStub = sandbox.stub(modelObject, 'save').resolves();

    await status.add({ date: new Date() } as IStatus);

    t.true(modelObjectSaveStub.calledOnce);
});

test.serial('status.getMostRecent should return the newest item in the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(common, 'validateConnection').returns(true);

    const queryExecStub = sandbox.stub(query, 'exec').resolves();

    await status.getMostRecent();

    t.true(t.context.querySortStub.calledOnce);
    t.is(t.context.querySortStub.args[0][0].date, -1);
    t.true(queryExecStub.calledOnce);
    t.true(t.context.statusFindOneStub.calledOnce);
    t.is(t.context.statusFindOneStub.args[0][0], void 0);
});
