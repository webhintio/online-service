import { promisify } from 'util';

import * as storage from 'azure-storage';

const { storageAccount, storageAccessKey } = process.env; // eslint-disable-line no-process-env

export class StorageContainer {
    public name: string;
    private blobService: storage.BlobService;
    private uploadBlob;
    private listBlobsSegmented;
    private startCopyBlob;
    private deleteBlobIfExists;

    public constructor(name: string, blobService: storage.BlobService) {
        this.name = name;
        this.blobService = blobService;
        this.startCopyBlob = promisify(blobService.startCopyBlob.bind(blobService));
        this.uploadBlob = promisify(blobService.createBlockBlobFromLocalFile.bind(blobService));
        this.deleteBlobIfExists = promisify(blobService.deleteBlobIfExists.bind(blobService));
        this.listBlobsSegmented = promisify(blobService.listBlobsSegmented.bind(blobService));
    }

    public uploadFile(blobName: string, filePath: string) {
        return this.uploadBlob(this.name, blobName, filePath);
    }

    public getBlobs(): Promise<Array<storage.BlobService.BlobResult>> {
        let entries: Array<storage.BlobService.BlobResult> = [];

        const get = async (token) => {
            const result: storage.BlobService.ListBlobsResult = await this.listBlobsSegmented(this.name, token);

            entries = entries.concat(result.entries);

            if (result.continuationToken) {
                return get(result.continuationToken);
            }

            return entries;
        };

        return get(null);
    }

    public copyBlob(blob: string, target: StorageContainer, targetName: string) {
        return this.startCopyBlob(`https://${storageAccount}.blob.core.windows.net/${this.name}/${blob}`, target.name, targetName);
    }

    public deleteBlob(blobName: string) {
        return this.deleteBlobIfExists(this.name, blobName);
    }
}

export const getContainer = async (name: string): Promise<StorageContainer> => {
    const service: storage.BlobService = storage.createBlobService(storageAccount, storageAccessKey).withFilter(new storage.ExponentialRetryPolicyFilter());
    const createContainer = promisify(service.createContainerIfNotExists.bind(service));

    await createContainer(name);

    return new StorageContainer(name, service);
};
