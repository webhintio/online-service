/* eslint-disable no-process-env */
import * as path from 'path';

import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { EventEmitter2 as EventEmitter } from 'eventemitter2';

import { delay } from '../../../../src/lib/utils/misc';

type ReplicaSetStatusMember = {
    name: string;
};

type ReplicaSetStatus = {
    members: Array<ReplicaSetStatusMember>;
    set: string;
};

const db = {
    connect() { },
    host(): string {
        return '';
    },
    replicaSetStatus(): ReplicaSetStatus {
        return null;
    }
};
const rimraf = (param: any, callback: any): void => { };
const rimrafContainer = { rimraf };
const tar = { c() { } };

const child_process = { // eslint-disable-line camelcase
    spawn(params): EventEmitter {
        return null;
    }
};

type Container = {
    copyBlob: (blob: string, container: any) => void;
    deleteBlob: (blob: string) => void;
    getBlobs: () => any;
    name: string;
    uploadFile: () => void;
};

const globbyObject = {
    globby() {
        return [];
    }
};

const container: Container = {
    copyBlob(blob: string, container: any) { },
    deleteBlob(blob: string) { },
    getBlobs() { },
    name: 'name',
    uploadFile() { }
};
const storage = {
    getContainer(): Promise<Container> {
        return null;
    }
};

type BackupTestContext = {
    sandbox: sinon.SinonSandbox;
    rimrafContainerRimrafStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<BackupTestContext>;

test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    /*
     * We need to use different values for process.env.database
     * so we need to clean the cache before each test.
     */
    delete require.cache[path.resolve(__dirname, '../../../../src/lib/microservices/backup-service/backup-service.js')];

    t.context.sandbox = sandbox;
    sandbox.stub(db, 'connect').returns(null);
    t.context.rimrafContainerRimrafStub = sandbox.stub(rimrafContainer, 'rimraf').callsFake((param, callback) => {
        callback(null, 'ok');
    });
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

const getEmitter = () => {
    const emitter = new EventEmitter();

    (emitter as any).stdout = {
        on() { },
        setEncoding() { }
    };

    (emitter as any).stderr = {
        on() { },
        setEncoding() { }
    };

    return emitter;
};

test.serial('"backup" a no replica set should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    const childProcessSpawnStub = sandbox.stub(child_process, 'spawn').returns(emitter);

    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = childProcessSpawnStub.args[0][0];

    t.true(command.includes('mongodump --host localhost --gzip'));
    t.false(command.includes('--oplog'));
    t.false(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial(`"backup" shouldn't upload anything if the backup process fail`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    const storageGetContainerStub = sandbox.spy(storage, 'getContainer');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 1);

    await promise;

    t.false(storageGetContainerStub.called);
});

test.serial('"backup" a no replica set with ssl should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017?ssl=true';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    const childProcessSpawnStub = sandbox.stub(child_process, 'spawn').returns(emitter);

    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = childProcessSpawnStub.args[0][0];

    t.true(command.includes('mongodump --host localhost --gzip'));
    t.false(command.includes('--oplog'));
    t.true(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" with the var authDatabase should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017?ssl=true';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    process.env.authDatabase = 'authDatabase';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    const childProcessSpawnStub = sandbox.stub(child_process, 'spawn').returns(emitter);

    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = childProcessSpawnStub.args[0][0];

    t.true(command.includes('mongodump --host localhost --authenticationDatabase authDatabase --gzip'));
    t.false(command.includes('--oplog'));
    t.true(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" a replica set should run the right command', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:password@192.168.1.1:27017,192.168.1.2:27017,192.168.1.3:27017/mydatabase?replicaSet=myreplica';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    process.env.authDatabase = '';
    const dbHostSpy = sandbox.spy(db, 'host');

    sandbox.stub(db, 'replicaSetStatus').returns({
        members: [
            { name: '192.168.1.1:27017' },
            { name: '192.168.1.2:27017' },
            { name: '192.168.1.3:27017' }
        ],
        set: 'myreplica'
    });
    const childProcessSpawnStub = sandbox.stub(child_process, 'spawn').returns(emitter);

    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = childProcessSpawnStub.args[0][0];

    t.false(dbHostSpy.called);
    t.true(command.includes('mongodump --host myreplica/192.168.1.1:27017,192.168.1.2:27017,192.168.1.3:27017 --gzip'));
    t.true(command.includes('--oplog'));
    t.false(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" should create a package and upload it to the storage', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    const tarCSpy = sandbox.spy(tar, 'c');

    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    const containerUploadFileSpy = sandbox.spy(container, 'uploadFile');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(containerUploadFileSpy.calledOnce);
    t.true(tarCSpy.calledOnce);
});

test.serial('"backup" should remove the local files created', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.spy(tar, 'c');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    sandbox.spy(container, 'uploadFile');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        rimraf: rimrafContainer.rimraf,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(t.context.rimrafContainerRimrafStub.calledOnce);
});

test.serial(`"backup" shouldn't remove any old backups if there isn't enough`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.spy(tar, 'c');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([
        { name: '20180124123501617.tar' },
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' }
    ]);
    const containerDeleteBlob = sandbox.spy(container, 'deleteBlob');

    sandbox.spy(container, 'uploadFile');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.false(containerDeleteBlob.called);
});

test.serial('"backup" should remove old backups', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();
    const x: string = 'patata';
    const y: string = 'pototo';

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.spy(tar, 'c');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([
        { name: '20180124123501617.tar' },
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);
    const containerDeleteBlob = sandbox.spy(container, 'deleteBlob');

    sandbox.spy(container, 'uploadFile');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(containerDeleteBlob.calledOnce);
    t.is(containerDeleteBlob.args[0][0], '20180123123501617.tar');
});

test.serial('"weeklyBackup" should copy the most recent backup', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const dailyContainer = _.cloneDeep(container);
    const weeklyContainer = _.cloneDeep(container);

    dailyContainer.name = 'backup';
    weeklyContainer.name = 'backupweekly';

    sandbox.stub(storage, 'getContainer')
        .onFirstCall()
        .resolves(dailyContainer)
        .onSecondCall()
        .resolves(weeklyContainer);
    const dailyContainerGetBlobsStub = sandbox.stub(dailyContainer, 'getBlobs').resolves([
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);

    sandbox.stub(weeklyContainer, 'getBlobs').resolves([]);
    const dailyContainerCopyBlobSpy = sandbox.spy(dailyContainer, 'copyBlob');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    await service.weeklyBackup();

    t.true(dailyContainerGetBlobsStub.calledOnce);
    const args = dailyContainerCopyBlobSpy.args[0];

    t.is(args[0], '20180124123501617.tar');
    t.is(args[1], weeklyContainer);
});

test.serial('if "weeklyBackup" fails nothgin should be copied', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const dailyContainer = _.cloneDeep(container);
    const weeklyContainer = _.cloneDeep(container);

    dailyContainer.name = 'backup';
    weeklyContainer.name = 'backupweekly';

    sandbox.stub(storage, 'getContainer')
        .onFirstCall()
        .resolves(dailyContainer)
        .onSecondCall()
        .resolves(weeklyContainer);
    sandbox.stub(dailyContainer, 'getBlobs').rejects(new Error('error'));
    const weeklyContainerGetBlobsSpy = sandbox.spy(weeklyContainer, 'getBlobs');
    const dailyContainerCopyBlobSpy = sandbox.spy(dailyContainer, 'copyBlob');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    t.plan(2);
    await service.weeklyBackup();

    t.false(weeklyContainerGetBlobsSpy.called);
    t.false(dailyContainerCopyBlobSpy.called);
});

test.serial(`"weeklyBackup" shouldn't remove any old backups if there isn't enough`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const dailyContainer = _.cloneDeep(container);
    const weeklyContainer = _.cloneDeep(container);

    dailyContainer.name = 'backup';
    weeklyContainer.name = 'backupweekly';

    sandbox.stub(storage, 'getContainer')
        .onFirstCall()
        .resolves(dailyContainer)
        .onSecondCall()
        .resolves(weeklyContainer);
    sandbox.stub(dailyContainer, 'getBlobs').resolves([
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);
    sandbox.stub(weeklyContainer, 'getBlobs').resolves([
        { name: '20180124123401.tar' },
        { name: '20180123123501.tar' }
    ]);
    const weeklyContainerDeleteBlobSpy = sandbox.spy(weeklyContainer, 'deleteBlob');
    const dailyContainerCopyBlobSpy = sandbox.spy(dailyContainer, 'copyBlob');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    await service.weeklyBackup();

    t.true(dailyContainerCopyBlobSpy.calledOnce);
    t.false(weeklyContainerDeleteBlobSpy.called);
});

test.serial(`"weeklyBackup" should remove old backups`, async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const dailyContainer = _.cloneDeep(container);
    const weeklyContainer = _.cloneDeep(container);

    dailyContainer.name = 'backup';
    weeklyContainer.name = 'backupweekly';

    sandbox.stub(storage, 'getContainer')
        .onFirstCall()
        .resolves(dailyContainer)
        .onSecondCall()
        .resolves(weeklyContainer);
    const dailyContainerGetBlobsStub = sandbox.stub(dailyContainer, 'getBlobs').resolves([
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);

    sandbox.stub(weeklyContainer, 'getBlobs').resolves([
        { name: '20180124123401.tar' },
        { name: '20180123123501.tar' },
        { name: '20180124123501.tar' },
        { name: '20180124123301.tar' },
        { name: '20180124123201.tar' }
    ]);
    sandbox.spy(dailyContainer, 'copyBlob');
    const weeklyContainerDeleteBlobSpy = sandbox.spy(weeklyContainer, 'deleteBlob');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    await service.weeklyBackup();

    t.true(dailyContainerGetBlobsStub.calledOnce);
    t.true(weeklyContainerDeleteBlobSpy.calledOnce);
    t.is(weeklyContainerDeleteBlobSpy.args[0][0], '20180123123501.tar');
});

test.serial('"monthlyBackup" should copy the most recent backup', async (t: TestContext) => {
    const sandbox = t.context.sandbox;
    const dailyContainer = _.cloneDeep(container);
    const monthlyContainer = _.cloneDeep(container);

    dailyContainer.name = 'backup';
    monthlyContainer.name = 'backupmonthly';

    sandbox.stub(storage, 'getContainer')
        .onFirstCall()
        .resolves(dailyContainer)
        .onSecondCall()
        .resolves(monthlyContainer);
    sandbox.stub(monthlyContainer, 'getBlobs').resolves([]);
    const dailyContainerGetBlobsStub = sandbox.stub(dailyContainer, 'getBlobs').resolves([
        { name: '20180124123401617.tar' },
        { name: '20180123123501617.tar' },
        { name: '20180124123501617.tar' },
        { name: '20180124123301617.tar' },
        { name: '20180124123201617.tar' },
        { name: '20180124123101617.tar' },
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);
    const dailyContainerCopyBlob = sandbox.spy(dailyContainer, 'copyBlob');

    const service = proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        globby: globbyObject.globby,
        tar
    });

    await service.monthlyBackup();

    t.true(dailyContainerGetBlobsStub.calledOnce);
    const args = dailyContainerCopyBlob.args[0];

    t.is(args[0], '20180124123501617.tar');
    t.is(args[1], monthlyContainer);
});
