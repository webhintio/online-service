/* eslint-disable no-process-env */
import * as path from 'path';

import test from 'ava';
import * as _ from 'lodash';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { EventEmitter2 as EventEmitter } from 'eventemitter2';

import { delay } from '../../../../src/lib/utils/misc';

const db = {
    connect() { },
    host() { },
    replicaSetStatus() { }
};
const rimraf = () => { };
const rimrafContainer = { rimraf };
const tar = { c() { } };

const child_process = { spawn() { } }; // eslint-disable-line camelcase

const container = {
    copyBlob() { },
    deleteBlob() { },
    getBlobs() { },
    name: 'name',
    uploadFile() { }
};
const storage = { getContainer() { } };

test.beforeEach((t) => {
    const sandbox = sinon.sandbox.create();

    /*
     * We need to use different values for process.env.database
     * so we need to clean the cache before each test.
     */
    delete require.cache[path.resolve(__dirname, '../../../../src/lib/microservices/backup-service/backup-service.js')];

    t.context.sandbox = sandbox;
    sandbox.stub(db, 'connect').returns();
    sandbox.stub(rimrafContainer, 'rimraf').callsFake((param, callback) => {
        callback(null, 'ok');
    });

    t.context.rimrafContainer = rimrafContainer;
});

test.afterEach.always((t) => {
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

test.serial('"backup" a no replica set should run the right command', async (t) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    t.context.childProcess = child_process; // eslint-disable-line camelcase

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = t.context.childProcess.spawn.args[0][0];

    t.true(command.includes('mongodump --host localhost --gzip'));
    t.false(command.includes('--oplog'));
    t.false(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial(`"backup" shouldn't upload anything if the backup process fail`, async (t) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.spy(storage, 'getContainer');
    t.context.storage = storage;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 1);

    await promise;

    t.false(t.context.storage.getContainer.called);
});

test.serial('"backup" a no replica set with ssl should run the right command', async (t) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017?ssl=true';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    t.context.childProcess = child_process; // eslint-disable-line camelcase

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = t.context.childProcess.spawn.args[0][0];

    t.true(command.includes('mongodump --host localhost --gzip'));
    t.false(command.includes('--oplog'));
    t.true(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" with the var authDatabase should run the right command', async (t) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:pass@localhost:27017?ssl=true';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    process.env.authDatabase = 'authDatabase';
    sandbox.stub(db, 'host').returns('localhost');
    sandbox.stub(db, 'replicaSetStatus').returns(null);
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    t.context.childProcess = child_process; // eslint-disable-line camelcase

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = t.context.childProcess.spawn.args[0][0];

    t.true(command.includes('mongodump --host localhost --authenticationDatabase authDatabase --gzip'));
    t.false(command.includes('--oplog'));
    t.true(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" a replica set should run the right command', async (t) => {
    const sandbox = t.context.sandbox;
    const emitter = getEmitter();

    process.env.database = 'mongodb://user:password@192.168.1.1:27017,192.168.1.2:27017,192.168.1.3:27017/mydatabase?replicaSet=myreplica';
    process.env.adminUser = 'adminUserName';
    process.env.adminPassword = 'adminPassword';
    process.env.authDatabase = '';
    sandbox.spy(db, 'host');
    sandbox.stub(db, 'replicaSetStatus').returns({
        members: [
            { name: '192.168.1.1:27017' },
            { name: '192.168.1.2:27017' },
            { name: '192.168.1.3:27017' }
        ],
        set: 'myreplica'
    });
    sandbox.stub(child_process, 'spawn').returns(emitter);
    sandbox.stub(storage, 'getContainer').resolves(container);
    sandbox.stub(container, 'getBlobs').resolves([]);
    t.context.childProcess = child_process; // eslint-disable-line camelcase
    t.context.db = db;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    const command = t.context.childProcess.spawn.args[0][0];

    t.false(t.context.db.host.called);
    t.true(command.includes('mongodump --host myreplica/192.168.1.1:27017,192.168.1.2:27017,192.168.1.3:27017 --gzip'));
    t.true(command.includes('--oplog'));
    t.false(command.includes('--ssl'));
    t.true(command.includes(`--username ${process.env.adminUser}`));
    t.true(command.includes(`--password ${process.env.adminPassword}`));
});

test.serial('"backup" should create a package and upload it to the storage', async (t) => {
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
    t.context.container = container;
    t.context.tar = tar;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(t.context.container.uploadFile.calledOnce);
    t.true(t.context.tar.c.calledOnce);
});

test.serial('"backup" should remove the local files created', async (t) => {
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
    t.context.container = container;
    t.context.tar = tar;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        rimraf: rimrafContainer.rimraf,
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(t.context.rimrafContainer.rimraf.calledOnce);
});

test.serial(`"backup" shouldn't remove any old backups if there isn't enough`, async (t) => {
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
    sandbox.spy(container, 'deleteBlob');
    sandbox.spy(container, 'uploadFile');
    t.context.container = container;
    t.context.tar = tar;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.false(t.context.container.deleteBlob.called);
});

test.serial('"backup" should remove old backups', async (t) => {
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
        { name: '20180124122901617.tar' },
        { name: '20180124122801617.tar' }
    ]);
    sandbox.spy(container, 'deleteBlob');
    sandbox.spy(container, 'uploadFile');
    t.context.container = container;
    t.context.tar = tar;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    const promise = service.backup();

    await delay(500);

    emitter.emit('exit', 0);

    await promise;

    t.true(t.context.container.deleteBlob.calledOnce);
    t.is(t.context.container.deleteBlob.args[0][0], '20180123123501617.tar');
});

test.serial('"weeklyBackup" should copy the most recent backup', async (t) => {
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
    sandbox.stub(weeklyContainer, 'getBlobs').resolves([]);
    sandbox.spy(dailyContainer, 'copyBlob');
    t.context.dailyContainer = dailyContainer;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    await service.weeklyBackup();

    t.true(t.context.dailyContainer.getBlobs.calledOnce);
    const args = t.context.dailyContainer.copyBlob.args[0];

    t.is(args[0], '20180124123501617.tar');
    t.is(args[1], weeklyContainer);
});

test.serial('if "weeklyBackup" fails nothgin should be copied', async (t) => {
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
    sandbox.spy(weeklyContainer, 'getBlobs');
    sandbox.spy(dailyContainer, 'copyBlob');
    t.context.dailyContainer = dailyContainer;
    t.context.weeklyContainer = weeklyContainer;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    t.plan(2);
    await service.weeklyBackup();

    t.false(t.context.weeklyContainer.getBlobs.called);
    t.false(t.context.dailyContainer.copyBlob.called);
});

test.serial(`"weeklyBackup" shouldn't remove any old backups if there isn't enough`, async (t) => {
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
    sandbox.spy(weeklyContainer, 'deleteBlob');
    sandbox.spy(dailyContainer, 'copyBlob');
    t.context.dailyContainer = dailyContainer;
    t.context.weeklyContainer = weeklyContainer;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    await service.weeklyBackup();

    t.true(t.context.dailyContainer.getBlobs.calledOnce);
    t.false(t.context.weeklyContainer.deleteBlob.called);
});

test.serial(`"weeklyBackup" should remove old backups`, async (t) => {
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
        { name: '20180123123501.tar' },
        { name: '20180124123501.tar' },
        { name: '20180124123301.tar' },
        { name: '20180124123201.tar' }
    ]);
    sandbox.spy(weeklyContainer, 'deleteBlob');
    sandbox.spy(dailyContainer, 'copyBlob');
    t.context.dailyContainer = dailyContainer;
    t.context.weeklyContainer = weeklyContainer;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    await service.weeklyBackup();

    t.true(t.context.dailyContainer.getBlobs.calledOnce);
    t.true(t.context.weeklyContainer.deleteBlob.calledOnce);
    t.is(t.context.weeklyContainer.deleteBlob.args[0][0], '20180123123501.tar');
});

test.serial('"monthlyBackup" should copy the most recent backup', async (t) => {
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
    sandbox.stub(monthlyContainer, 'getBlobs').resolves([]);
    sandbox.spy(dailyContainer, 'copyBlob');
    t.context.dailyContainer = dailyContainer;

    proxyquire('../../../../src/lib/microservices/backup-service/backup-service', {
        '../../common/database/database': db,
        '../../common/storage/storage': storage,
        child_process, // eslint-disable-line camelcase
        tar
    });

    const service = require('../../../../src/lib/microservices/backup-service/backup-service');

    await service.monthlyBackup();

    t.true(t.context.dailyContainer.getBlobs.calledOnce);
    const args = t.context.dailyContainer.copyBlob.args[0];

    t.is(args[0], '20180124123501617.tar');
    t.is(args[1], monthlyContainer);
});
