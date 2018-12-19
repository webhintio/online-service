import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

const mongoose = {
    connect() { },
    disconnect() { }
};

const dbLock = {
    acquire(callback) {
        callback(null, 'code');
    },
    ensureIndexes() { },
    release() { }
};

const mongoDBLock = () => {
    return dbLock;
};

const db = {
    connection: {
        db: { command({ replSetGetStatus: number }) { } },
        host: 'localhost',
        port: 27017
    }
};

type DBCommonTestContext = {
    sandbox: sinon.SinonSandbox;
    mongooseConnectStub: sinon.SinonStub;
    dbLockEnsureIndexes: sinon.SinonStub;
};

type TestContext = ExecutionContext<DBCommonTestContext>;

proxyquire('../../../../src/lib/common/database/methods/common', {
    'mongodb-lock': mongoDBLock,
    mongoose
});

import * as dbCommon from '../../../../src/lib/common/database/methods/common';

const connectDatabase = async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.mongooseConnectStub = sandbox.stub(mongoose, 'connect').resolves(db);
    t.context.dbLockEnsureIndexes = sandbox.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await dbCommon.connect('connectionString');
};

test.beforeEach((t: TestContext) => {
    t.context.sandbox = sinon.createSandbox();
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('unlock should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('lock should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('replicaSetStatus should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);

    try {
        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('host should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);

    try {
        await dbCommon.host();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});


test.serial('disconnect should do nothing if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const mongooseDisconnectSpy = sandbox.spy(mongoose, 'disconnect');

    await dbCommon.disconnect();

    t.false(mongooseDisconnectSpy.called);
});

test.serial('unlock should call to releaseAsync', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const lock = { releaseAsync() { } };

    await connectDatabase(t);

    const lockReleaseAsync = sandbox.stub(lock, 'releaseAsync').resolves([]);

    await dbCommon.unlock(lock);

    t.true(lockReleaseAsync.calledOnce);
});

test.serial('connect should connect to mongoose and create an index', async (t: TestContext) => {
    await connectDatabase(t);

    t.true(t.context.mongooseConnectStub.calledOnce);
    t.true(t.context.dbLockEnsureIndexes.calledOnce);
});

test.serial('if connect fail, it should throw an error', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const errorMessage = 'error connecting';

    t.context.mongooseConnectStub = sandbox.stub(mongoose, 'connect').rejects(new Error(errorMessage));
    t.context.dbLockEnsureIndexes = sandbox.stub(dbLock, 'ensureIndexes').callsArg(0);

    t.plan(3);
    try {
        await dbCommon.connect('conectionString');
    } catch (err) {
        t.is(err.message, errorMessage);
        t.true(t.context.mongooseConnectStub.calledOnce);
        t.false(t.context.dbLockEnsureIndexes.called);
    }
});

test.serial('if ensureIndexes fail, it should throw an error', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const errorMessage = 'error connecting';

    t.context.mongooseConnectStub = sandbox.stub(mongoose, 'connect').resolves({ connection: {} });
    t.context.dbLockEnsureIndexes = sandbox.stub(dbLock, 'ensureIndexes').callsArgWith(0, errorMessage);

    t.plan(3);
    try {
        await dbCommon.connect('conectionString');
    } catch (err) {
        t.is(err, errorMessage);
        t.true(t.context.mongooseConnectStub.calledOnce);
        t.true(t.context.dbLockEnsureIndexes.calledOnce);
    }
});

test.serial('lock should lock the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    await connectDatabase(t);

    const dbLockAcquireStub = sandbox.stub(dbLock, 'acquire').callsFake((callback) => {
        callback(null, 'code');
    });

    const lock = await dbCommon.lock('url');

    t.true(dbLockAcquireStub.calledOnce);
});

test.serial('if database is locked, it should retry to lock the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    await connectDatabase(t);

    const dbLockAcquireStub = sandbox.stub(dbLock, 'acquire')
        .onFirstCall()
        .callsFake((callback) => {
            callback(null, null);
        })
        .onSecondCall()
        .callsFake((callback) => {
            callback(null, 'code');
        });

    const lock = await dbCommon.lock('url');

    t.true(dbLockAcquireStub.calledTwice);
});

test.serial('if database is locked for a long time, it should throw an error', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    await connectDatabase(t);

    const dbLockAcquireStub = sandbox.stub(dbLock, 'acquire')
        .callsFake((callback) => {
            callback(null, null);
        });

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(dbLockAcquireStub.callCount, 10);
        t.is(err.message, 'Lock not acquired');
    }
});

test.serial('replicaSetStatus should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbConnectionDbCommandStub = sandbox.stub(db.connection.db, 'command').resolves({});

    await dbCommon.replicaSetStatus();

    t.true(dbConnectionDbCommandStub.called);

    const arg = dbConnectionDbCommandStub.args[0][0];

    t.is(arg.replSetGetStatus, 1);
});

test.serial('replicaSetStatus should return null if the database is not running --replset', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbConnectionDbCommandStub = sandbox.stub(db.connection.db, 'command').rejects(new Error('not running with --replset'));

    const status = await dbCommon.replicaSetStatus();

    t.true(dbConnectionDbCommandStub.called);

    t.is(status, null);
});

test.serial('replicaSetStatus should fail if there is an error runing the command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbConnectionDbCommandStub = sandbox.stub(db.connection.db, 'command').rejects(new Error('error'));

    t.plan(1);

    try {
        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'error');
    }
});

test.serial('host should return the string "host:port"', (t: TestContext) => {
    const host = dbCommon.host();

    t.is(host, 'localhost:27017');
});

test.serial('disconnect should call to mongoose.disconnect', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    await connectDatabase(t);

    const mongooseDisconnectStub = sandbox.stub(mongoose, 'disconnect').resolves();

    dbCommon.disconnect();

    t.true(mongooseDisconnectStub.called);
});
