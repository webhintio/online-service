import test, { ExecutionContext } from 'ava';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

process.env.storageAccount = 'storageAccount'; // eslint-disable-line no-process-env

type BlobService = {
    createBlockBlobFromLocalFile: (containerName: string, blobName: string, filePath: string, callback: Function) => BlobService;
    createContainerIfNotExists: (name: any, callback: any) => void;
    deleteBlobIfExists: (containerName: string, blobName: string, callback: Function) => BlobService;
    listBlobsSegmented: (containerName: string, token: string, callback: Function) => BlobService;
    startCopyBlob: (blobUri: string, targetContainerName: string, targetName: string, callback: Function) => BlobService;
    withFilter: () => BlobService;
};

const blobService: BlobService = {
    createBlockBlobFromLocalFile(containerName: string, blobName: string, filePath: string, callback: Function): BlobService {
        return blobService;
    },
    createContainerIfNotExists() { },
    deleteBlobIfExists(containerName: string, blobName: string, callback: Function): BlobService {
        return blobService;
    },
    listBlobsSegmented(containerName: string, token: string, callback: Function): BlobService {
        return blobService;
    },
    startCopyBlob(blobUri: string, targetContainerName: string, targetName: string, callback: Function): BlobService {
        return blobService;
    },
    withFilter() {
        return blobService;
    }
};
const azureStorage = {
    createBlobService() {
        return blobService;
    },
    ExponentialRetryPolicyFilter: function () { } // eslint-disable-line object-shorthand
};

type StorageTestContext = {
    sandbox: sinon.SinonSandbox;
    blobServiceWithFilterStub: sinon.SinonStub;
    blobServiceCreateContainerIfNotExistsStub: sinon.SinonStub;
};

type TestContext = ExecutionContext<StorageTestContext>;

proxyquire('../../../../src/lib/common/storage/storage', { 'azure-storage': azureStorage });

import * as service from '../../../../src/lib/common/storage/storage';


test.beforeEach((t: TestContext) => {
    const sandbox = sinon.createSandbox();

    sandbox.stub(azureStorage, 'createBlobService').returns(blobService);
    t.context.blobServiceWithFilterStub = sandbox.stub(blobService, 'withFilter').returns(blobService);
    t.context.blobServiceCreateContainerIfNotExistsStub = sandbox.stub(blobService, 'createContainerIfNotExists').callsFake((name, callback) => {
        callback(null, 'ok');
    });

    t.context.sandbox = sandbox;
});

test.afterEach.always((t: TestContext) => {
    t.context.sandbox.restore();
});

test.serial('getContainer should return a StorageContainer', async (t: TestContext) => {
    const container = await service.getContainer('newcontainer');

    t.true(container instanceof service.StorageContainer);
});

test.serial('container.uploadFile should call to createBlockBlobFromLocalFile with the right data', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const blobServiceCreateBlockBlobFromLocalFileStub = sandbox.stub(blobService, 'createBlockBlobFromLocalFile').callsFake((containerName, blobName, filePath, callback) => {
        return callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');

    await container.uploadFile('blobName.ext', 'pathToFile');

    t.true(blobServiceCreateBlockBlobFromLocalFileStub.calledOnce);
    const args = blobServiceCreateBlockBlobFromLocalFileStub.args[0];

    t.is(args[0], 'newcontainer');
    t.is(args[1], 'blobName.ext');
    t.is(args[2], 'pathToFile');
});

test.serial('container.getBlobs should call to listBlobsSegmented with the right data', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const blobServiceListBlobsSegmentedStub = sandbox.stub(blobService, 'listBlobsSegmented')
        .onFirstCall()
        .callsFake((containerName, token, callback) => {
            return callback(null, {
                continuationToken: 'asdf',
                entries: [
                    'item1',
                    'item2'
                ]
            });
        })
        .onSecondCall()
        .callsFake((containerName, token, callback) => {
            return callback(null, {
                entries: [
                    'item3'
                ]
            });
        });

    const container = await service.getContainer('newcontainer');

    const blobs = await container.getBlobs();

    t.true(blobServiceListBlobsSegmentedStub.calledTwice);
    const args1 = blobServiceListBlobsSegmentedStub.args[0];
    const args2 = blobServiceListBlobsSegmentedStub.args[1];

    t.is(args1[0], 'newcontainer');
    t.is(args1[1], null);
    t.is(args2[0], 'newcontainer');
    t.is(args2[1], 'asdf');
    t.is(blobs.length, 3);
});

test.serial('container.copyBlob should call to startCopyBlob with the right data', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const blobServiceStartCopyBlobStub = sandbox.stub(blobService, 'startCopyBlob').callsFake((blobUri, targetContainerName, targetName, callback) => {
        return callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');
    const targetContainer = await service.getContainer('targetContainer');

    await container.copyBlob('blobName.ext', targetContainer, 'targetName.ext');

    t.true(blobServiceStartCopyBlobStub.calledOnce);
    const args = blobServiceStartCopyBlobStub.args[0];

    t.is(args[0], 'https://storageAccount.blob.core.windows.net/newcontainer/blobName.ext');
    t.is(args[1], 'targetContainer');
    t.is(args[2], 'targetName.ext');
});

test.serial('container.deleteBlob should call to deleteBlobIfExists with the right data', async (t: TestContext) => {
    const sandbox = t.context.sandbox;

    const blobServiceDeleteBlobIfExistsStub = sandbox.stub(blobService, 'deleteBlobIfExists').callsFake((containerName, blobName, callback) => {
        return callback(null, 'ok');
    });

    const container = await service.getContainer('newcontainer');

    await container.deleteBlob('blobName.ext');

    t.true(blobServiceDeleteBlobIfExistsStub.calledOnce);
    const args = blobServiceDeleteBlobIfExistsStub.args[0];

    t.is(args[0], 'newcontainer');
    t.is(args[1], 'blobName.ext');
});
