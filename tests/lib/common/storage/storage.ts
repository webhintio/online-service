import test from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

process.env.storageAccount = 'storageAccount'; // eslint-disable-line no-process-env
const blobService = {
    createBlockBlobFromLocalFile() { },
    createContainerIfNotExists() { },
    deleteBlobIfExists() { },
    listBlobsSegmented() { },
    startCopyBlob() { },
    withFilter() { }
};
const azureStorage = {
    ExponentialRetryPolicyFilter: function () { }, // eslint-disable-line object-shorthand
    createBlobService() {
        return blobService;
    }
};

proxyquire('../../../../src/lib/common/storage/storage', { 'azure-storage': azureStorage });

import * as service from '../../../../src/lib/common/storage/storage';


test.beforeEach((t) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(azureStorage, 'createBlobService').returns(blobService);
    sandbox.stub(blobService, 'withFilter').returns(blobService);
    sandbox.stub(blobService, 'createContainerIfNotExists').callsFake((name, callback) => {
        callback(null, 'ok');
    });

    t.context.sandbox = sandbox;
    t.context.blobService = blobService;
});

test.afterEach.always((t) => {
    t.context.sandbox.restore();
});

test.serial('getContainer should return a StorageContainer', async (t) => {
    const container = await service.getContainer('newcontainer');

    t.true(container instanceof service.StorageContainer);
});

test.serial('container.uploadFile should call to createBlockBlobFromLocalFile with the right data', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(blobService, 'createBlockBlobFromLocalFile').callsFake((containerName, blobName, filePath, callback) => {
        callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');

    await container.uploadFile('blobName.ext', 'pathToFile');

    t.true(t.context.blobService.createBlockBlobFromLocalFile.calledOnce);
    const args = t.context.blobService.createBlockBlobFromLocalFile.args[0];

    t.is(args[0], 'newcontainer');
    t.is(args[1], 'blobName.ext');
    t.is(args[2], 'pathToFile');
});

test.serial('container.getBlobs should call to listBlobsSegmented with the right data', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(blobService, 'listBlobsSegmented')
        .onFirstCall()
        .callsFake((containerName, token, callback) => {
            callback(null, {
                continuationToken: 'asdf',
                entries: [
                    'item1',
                    'item2'
                ]
            });
        })
        .onSecondCall()
        .callsFake((containerName, token, callback) => {
            callback(null, {
                entries: [
                    'item3'
                ]
            });
        });

    const container = await service.getContainer('newcontainer');

    const blobs = await container.getBlobs();

    t.true(t.context.blobService.listBlobsSegmented.calledTwice);
    const args1 = t.context.blobService.listBlobsSegmented.args[0];
    const args2 = t.context.blobService.listBlobsSegmented.args[1];

    t.is(args1[0], 'newcontainer');
    t.is(args1[1], null);
    t.is(args2[0], 'newcontainer');
    t.is(args2[1], 'asdf');
    t.is(blobs.length, 3);
});

test.serial('container.copyBlob should call to startCopyBlob with the right data', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(blobService, 'startCopyBlob').callsFake((blobUri, targetContainerName, targetName, callback) => {
        callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');
    const targetContainer = await service.getContainer('targetContainer');

    await container.copyBlob('blobName.ext', targetContainer, 'targetName.ext');

    t.true(t.context.blobService.startCopyBlob.calledOnce);
    const args = t.context.blobService.startCopyBlob.args[0];

    t.is(args[0], 'https://storageAccount.blob.core.windows.net/newcontainer/blobName.ext');
    t.is(args[1], 'targetContainer');
    t.is(args[2], 'targetName.ext');
});

test.serial('container.deleteBlob should call to deleteBlobIfExists with the right data', async (t) => {
    const sandbox = t.context.sandbox;

    sandbox.stub(blobService, 'deleteBlobIfExists').callsFake((containerName, blobName, callback) => {
        callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');

    await container.deleteBlob('blobName.ext');

    t.true(t.context.blobService.deleteBlobIfExists.calledOnce);
    const args = t.context.blobService.deleteBlobIfExists.args[0];

    t.is(args[0], 'newcontainer');
    t.is(args[1], 'blobName.ext');
});
