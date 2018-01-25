import { promisify } from 'util';

import * as storage from 'azure-storage';

const { storageAccount, storageAccessKey } = process.env; // eslint-disable-line no-process-env

/**
 * Wrapper for all the actions we need in a azure storage container.
 */
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

    /**
     * Upload a new blob to the container.
     * @param {string} blobName - Name for the new blob.
     * @param {string} filePath - File path to upload.
     */
    public uploadFile(blobName: string, filePath: string) {
        return this.uploadBlob(this.name, blobName, filePath);
    }

    /**
     * Get a list with all the blobs in a container.
     */
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

    /**
     * Copy a blob from a container to another.
     * @param {string} blobName - Blob to copy.
     * @param {StorageContainer} target - Target container.
     * @param {string} targetName - Name in the new container.
     */
    public copyBlob(blobName: string, target: StorageContainer, targetName: string) {
        return this.startCopyBlob(`https://${storageAccount}.blob.core.windows.net/${this.name}/${blobName}`, target.name, targetName);
    }

    /**
     * Delete a blob from the container.
     * @param {string} blobName - Blob name.
     */
    public deleteBlob(blobName: string) {
        return this.deleteBlobIfExists(this.name, blobName);
    }
}

/**
 * Create and return a storage container.
 * @param {string} name - Container name. 
 */
export const getContainer = async (name: string): Promise<StorageContainer> => {
    const service: storage.BlobService = storage.createBlobService(storageAccount, storageAccessKey).withFilter(new storage.ExponentialRetryPolicyFilter());
    const createContainer = promisify(service.createContainerIfNotExists.bind(service));

    await createContainer(name);

    return new StorageContainer(name, service);
};
