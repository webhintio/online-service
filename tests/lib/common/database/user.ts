import test from 'ava';
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

proxyquire('../../../../src/lib/common/database/methods/user', {
    '../models/user': userModels,
    './common': common
});

import * as user from '../../../../src/lib/common/database/methods/user';

test.beforeEach((t) => {
    sinon.stub(User, 'find').returns(query);
    sinon.stub(User, 'findOne').returns(query);
    sinon.stub(query, 'remove').returns(query);

    t.context.query = query;
    t.context.User = User;
    t.context.common = common;
});

test.afterEach.always((t) => {
    t.context.query.remove.restore();
    t.context.User.find.restore();
    t.context.User.findOne.restore();

    if (t.context.common.validateConnection.restore) {
        t.context.common.validateConnection.restore();
    }
});

test.serial('user.add should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.add('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.get should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.get('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.remove should fail if database is not connected', async (t) => {
    sinon.stub(common, 'validateConnection').throws(error);
    t.plan(1);
    try {
        await user.remove('name');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('user.add should save a new user in database', async (t) => {
    sinon.stub(modelObject, 'save').resolves();

    t.context.modelObject = modelObject;

    await user.add('userName');

    t.true(t.context.modelObject.save.calledOnce);

    t.context.modelObject.save.restore();
});

test.serial('user.getAll should return all users in the database', async (t) => {
    sinon.stub(query, 'exec').resolves();

    await user.getAll();

    t.deepEqual(t.context.User.find.args[0][0], {});
    t.true(t.context.User.find.calledOnce);

    t.context.query.exec.restore();
});

test.serial('user.get should return an user', async (t) => {
    const name = 'userName';

    sinon.stub(query, 'exec').resolves();

    await user.get(name);

    t.deepEqual(t.context.User.findOne.args[0][0].name, name);
    t.true(t.context.User.findOne.calledOnce);

    t.context.query.exec.restore();
});

test.serial('user.remove should remove an user from the database', async (t) => {
    const name = 'userName';

    sinon.stub(query, 'exec').resolves();

    await user.remove(name);

    t.true(t.context.query.exec.calledOnce);
    t.true(t.context.query.remove.calledOnce);
    t.true(t.context.User.findOne.calledOnce);
    t.is(t.context.User.findOne.args[0][0].name, name);

    t.context.query.exec.restore();
});
