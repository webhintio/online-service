import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

type DatabaseConnectionDB = {
    command: ({ replSetGetStatus: number }) => Promise<any>;
};

type DatabaseConnection = {
    db: DatabaseConnectionDB;
    host: string;
    port: number;
    collection: any;
};

type Database = {
    connection: DatabaseConnection;
};

type Mongoose = {
    connect: () => Promise<Database>;
    disconnect: () => void;
}

type DBLock = {
    acquire: (callback) => void;
    ensureIndexes: () => void;
    release: () => void;
}

type MongoDBLock = () => DBLock;

type DBCommonTestContext = {
    db: Database;
    dbLock: DBLock;
    dbLockEnsureIndexes: sinon.SinonStub;
    mongoDBLock: MongoDBLock;
    mongoose: Mongoose;
    mongooseConnectStub: sinon.SinonStub;
    sandbox: sinon.SinonSandbox;
};

type TestContext = ExecutionContext<DBCommonTestContext>;

const loadScript = (context: DBCommonTestContext): typeof import('../../../../src/lib/common/database/methods/common') => {
    return proxyquire('../../../../src/lib/common/database/methods/common', {
        'mongodb-lock': context.mongoDBLock,
        mongoose: context.mongoose
    });
};

const connectDatabase = async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    t.context.mongooseConnectStub = sandbox.stub(t.context.mongoose, 'connect').resolves(t.context.db);
    t.context.dbLockEnsureIndexes = sandbox.stub(t.context.dbLock, 'ensureIndexes').callsArg(0);
    const dbCommon = loadScript(t.context);

    // We need to be connected to the database before lock it
    await dbCommon.connect('connectionString');

    return dbCommon;
};

test.beforeEach((t: TestContext) => {
    t.context.sandbox = sinon.createSandbox();

    t.context.dbLock = {
        acquire(callback) {
            callback(null, 'code');
        },
        ensureIndexes() { },
        release() { }
    };

    t.context.mongoDBLock = () => {
        return t.context.dbLock;
    };

    t.context.mongoose = {
        connect(): Promise<Database> {
            return null;
        },
        disconnect() { }
    };

    t.context.db = {
        connection: {
            collection() {
                return [];
            },
            db: {
                command({ replSetGetStatus: number }): Promise<any> {
                    return null;
                }
            },
            host: 'localhost',
            port: 27017
        }
    };
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('unlock should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);
    const dbCommon = loadScript(t.context);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('lock should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);
    const dbCommon = loadScript(t.context);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('replicaSetStatus should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);
    const dbCommon = loadScript(t.context);

    try {
        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});

test.serial('host should fail if database is not connected', async (t: TestContext) => {
    t.plan(1);
    const dbCommon = loadScript(t.context);

    try {
        await dbCommon.host();
    } catch (err) {
        t.is(err.message, 'Database not connected');
    }
});


test.serial('disconnect should do nothing if database is not connected', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const mongooseDisconnectSpy = sandbox.spy(t.context.mongoose, 'disconnect');
    const dbCommon = loadScript(t.context);

    await dbCommon.disconnect();

    t.false(mongooseDisconnectSpy.called);
});

test.serial('unlock should call to releaseAsync', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const lock = {
        releaseAsync(): Promise<any> {
            return null;
        }
    };

    const lockReleaseAsync = sandbox.stub(lock, 'releaseAsync').resolves([]);

    const dbCommon = await connectDatabase(t);

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

    t.context.mongooseConnectStub = sandbox.stub(t.context.mongoose, 'connect').rejects(new Error(errorMessage));
    t.context.dbLockEnsureIndexes = sandbox.stub(t.context.dbLock, 'ensureIndexes').callsArg(0);

    t.plan(3);
    try {
        const dbCommon = loadScript(t.context);

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

    t.context.mongooseConnectStub = sandbox.stub(t.context.mongoose, 'connect').resolves(t.context.db);
    t.context.dbLockEnsureIndexes = sandbox.stub(t.context.dbLock, 'ensureIndexes').callsArgWith(0, errorMessage);

    t.plan(3);
    try {
        const dbCommon = loadScript(t.context);

        await dbCommon.connect('conectionString');
    } catch (err) {
        t.is(err, errorMessage);
        t.true(t.context.mongooseConnectStub.calledOnce);
        t.true(t.context.dbLockEnsureIndexes.calledOnce);
    }
});

test.serial('lock should lock the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbLockAcquireStub = sandbox.stub(t.context.dbLock, 'acquire').callsFake((callback) => {
        callback(null, 'code');
    });
    const dbCommon = await connectDatabase(t);

    await dbCommon.lock('url');

    t.true(dbLockAcquireStub.calledOnce);
});

test.serial('if database is locked, it should retry to lock the database', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbLockAcquireStub = sandbox.stub(t.context.dbLock, 'acquire')
        .onFirstCall()
        .callsFake((callback) => {
            callback(null, null);
        })
        .onSecondCall()
        .callsFake((callback) => {
            callback(null, 'code');
        });
    const dbCommon = await connectDatabase(t);

    await dbCommon.lock('url');

    t.true(dbLockAcquireStub.calledTwice);
});

test.serial('if database is locked for a long time, it should throw an error', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbLockAcquireStub = sandbox.stub(t.context.dbLock, 'acquire')
        .callsFake((callback) => {
            callback(null, null);
        });

    const dbCommon = await connectDatabase(t);

    try {
        await dbCommon.lock('url');
    } catch (err) {
        t.is(dbLockAcquireStub.callCount, 10);
        t.is(err.message, 'Lock not acquired');
    }
});

test.serial('replicaSetStatus should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbConnectionDbCommandStub = sandbox.stub(t.context.db.connection.db, 'command').resolves({});
    const dbCommon = await connectDatabase(t);

    await dbCommon.replicaSetStatus();

    t.true(dbConnectionDbCommandStub.called);

    const arg = dbConnectionDbCommandStub.args[0][0];

    t.is(arg.replSetGetStatus, 1);
});

test.serial('replicaSetStatus should return null if the database is not running --replset', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const dbConnectionDbCommandStub = sandbox.stub(t.context.db.connection.db, 'command').rejects(new Error('not running with --replset'));
    const dbCommon = await connectDatabase(t);

    const status = await dbCommon.replicaSetStatus();

    t.true(dbConnectionDbCommandStub.called);

    t.is(status, null);
});

test.serial('replicaSetStatus should fail if there is an error runing the command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(t.context.db.connection.db, 'command').rejects(new Error('error'));

    t.plan(1);

    try {
        const dbCommon = await connectDatabase(t);

        await dbCommon.replicaSetStatus();
    } catch (err) {
        t.is(err.message, 'error');
    }
});

test.serial('host should return the string "host:port"', async (t: TestContext) => {
    const dbCommon = await connectDatabase(t);

    const host = dbCommon.host();

    t.is(host, 'localhost:27017');
});

test.serial('disconnect should call to mongoose.disconnect', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const mongooseDisconnectStub = sandbox.stub(t.context.mongoose, 'disconnect').resolves();

    const dbCommon = await connectDatabase(t);

    dbCommon.disconnect();

    t.true(mongooseDisconnectStub.called);
});
