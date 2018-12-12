import test from 'ava';
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

import * as status from '../../../../src/lib/common/database/methods/status';

test.beforeEach((t) => {
    sinon.stub(Status, 'findOne').returns(query);
    sinon.stub(query, 'sort').returns(query);

    t.context.query = query;
    t.context.Status = Status;
    t.context.common = common;
});

test.afterEach.always((t) => {
    t.context.Status.findOne.restore();
    t.context.query.sort.restore();

    if (t.context.common.validateConnection.restore) {
        t.context.common.validateConnection.restore();
    }
});

test.serial('status.add should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.add(null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.update should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.update(null, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.getMostRecent should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.getMostRecent();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.getByDate should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await status.getByDate(null, null);
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('status.add should create a new status in database', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await status.add({ date: new Date() } as IStatus);

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('status.getMostRecent should return the newest item in the database', async (t) => {
    sinon.stub(common, 'validateConnection').returns(true);

    sinon.stub(query, 'exec').resolves();

    await status.getMostRecent();

    t.true(t.context.query.sort.calledOnce);
    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.Status.findOne.calledOnce);
    t.is(t.context.Status.findOne.args[0][0], void 0);
    t.is(t.context.query.sort.args[0][0].date, -1);

    t.context.query.exec.restore();
});
