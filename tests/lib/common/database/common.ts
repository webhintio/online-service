import test from 'ava';
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
        db: { command() { } },
        host: 'localhost',
        port: 27017
    }
};

proxyquire('../../../../src/lib/common/database/methods/common', {
    'mongodb-lock': mongoDBLock,
    mongoose
});

import * as dbCommon from '../../../../src/lib/common/database/methods/common';

const connectDatabase = async () => {
    sinon.stub(mongoose, 'connect').resolves(db);
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    // We need to be connected to the database before lock it
    await dbCommon.connect('connectionString');
};

test.beforeEach((t) => {
    t.context.db = db;
    t.context.mongoose = mongoose;
    t.context.dbLock = dbLock;
});

test.afterEach.always((t) => {
    if (t.context.mongoose.connect.restore) {
        t.context.mongoose.connect.restore();
    }

    if (t.context.mongoose.disconnect.restore) {
        t.context.mongoose.disconnect.restore();
    }

    if (t.context.dbLock.ensureIndexes.restore) {
        t.context.dbLock.ensureIndexes.restore();
    }

    if (t.context.db.connection.db.command.restore) {
        t.context.db.connection.db.command.restore();
    }
});

test.serial('unlock should fail if database is not connected', async (t) => {
    t.plan(1);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('lock should fail if database is not connected', async (t) => {
    t.plan(1);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('replicaSetStatus should fail if database is not connected', async (t) => {
    t.plan(1);

    try {
        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('host should fail if database is not connected', async (t) => {
    t.plan(1);

    try {
        await dbCommon.host();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});


test.serial('disconnect should do nothing if database is not connected', async (t) => {
    sinon.spy(mongoose, 'disconnect');

    await dbCommon.disconnect();

    t.false(t.context.mongoose.disconnect.called);
});

test.serial('unlock should call to releaseAsync', async (t) => {
    const lock = { releaseAsync() { } };

    await connectDatabase();

    t.context.lock = lock;
    sinon.stub(lock, 'releaseAsync').resolves([]);

    await dbCommon.unlock(lock);

    t.true(t.context.lock.releaseAsync.calledOnce);

    t.context.lock.releaseAsync.restore();
});

test.serial('connect should connect to mongoose and create an index', async (t) => {
    await connectDatabase();

    t.true(t.context.mongoose.connect.calledOnce);
    t.true(t.context.dbLock.ensureIndexes.calledOnce);
});

test.serial('if connect fail, it should throw an error', async (t) => {
    const errorMessage = 'error connecting';

    sinon.stub(mongoose, 'connect').rejects(new Error(errorMessage));
    sinon.stub(dbLock, 'ensureIndexes').callsArg(0);

    t.plan(3);
    try {
        await dbCommon.connect('conectionString');
    } catch (err) {
        t.is(err.message, errorMessage);
        t.true(t.context.mongoose.connect.calledOnce);
        t.false(t.context.dbLock.ensureIndexes.called);
    }
});

test.serial('if ensureIndexes fail, it should throw an error', async (t) => {
    const errorMessage = 'error connecting';

    sinon.stub(mongoose, 'connect').resolves({ connection: {} });
    sinon.stub(dbLock, 'ensureIndexes').callsArgWith(0, errorMessage);

    t.plan(3);
    try {
        await dbCommon.connect('conectionString');
    } catch (err) {
        t.is(err, errorMessage);
        t.true(t.context.mongoose.connect.calledOnce);
        t.true(t.context.dbLock.ensureIndexes.calledOnce);
    }
});

test.serial('lock should lock the database', async (t) => {
    await connectDatabase();

    sinon.stub(dbLock, 'acquire').callsFake((callback) => {
        callback(null, 'code');
    });

    const lock = await dbCommon.lock('url');

    t.true(lock.acquire.calledOnce);

    t.context.dbLock.acquireAsync.restore();
});

test.serial('if database is locked, it should retry to lock the database', async (t) => {
    await connectDatabase();

    sinon.stub(dbLock, 'acquire')
        .onFirstCall()
        .callsFake((callback) => {
            callback(null, null);
        })
        .onSecondCall()
        .callsFake((callback) => {
            callback(null, 'code');
        });

    const lock = await dbCommon.lock('url');

    t.true(lock.acquire.calledTwice);

    t.context.dbLock.acquireAsync.restore();
});

test.serial('if database is locked for a long time, it should throw an error', async (t) => {
    await connectDatabase();

    sinon.stub(dbLock, 'acquire')
        .callsFake((callback) => {
            callback(null, null);
        });

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(t.context.dbLock.acquire.callCount, 10);
        t.is(err.message, 'Lock not acquired');
    }

    t.context.dbLock.acquireAsync.restore();
});

test.serial('replicaSetStatus should run the right command', async (t) => {
    sinon.stub(db.connection.db, 'command').resolves({});

    await dbCommon.replicaSetStatus();

    t.true(t.context.db.connection.db.command.called);

    const arg = t.context.db.connection.db.command.args[0][0];

    t.is(arg.replSetGetStatus, 1);
});

test.serial('replicaSetStatus should return null if the database is not running --replset', async (t) => {
    sinon.stub(db.connection.db, 'command').rejects(new Error('not running with --replset'));

    const status = await dbCommon.replicaSetStatus();

    t.true(t.context.db.connection.db.command.called);

    t.is(status, null);
});

test.serial('replicaSetStatus should fail if there is an error runing the command', async (t) => {
    sinon.stub(db.connection.db, 'command').rejects(new Error('error'));

    t.plan(1);

    try {
        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'error');
    }
});

test.serial('host should return the string "host:port"', (t) => {
    const host = dbCommon.host();

    t.is(host, 'localhost:27017');
});

test.serial('disconnect should call to mongoose.disconnect', async (t) => {
    await connectDatabase();

    sinon.stub(mongoose, 'disconnect').resolves();

    dbCommon.disconnect();

    t.true(t.context.mongoose.disconnect.called);
});
