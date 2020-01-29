import { Storage } from '@google-cloud/storage';
import { BucketProvider, BucketOptions, BucketProviderResponse, GCSBucketOptions } from '../types';
import { resolve, basename } from 'path';

export class GCSBucketProvider implements BucketProvider {
  private storage: Storage;
  constructor (options: BucketOptions) {
    const keyFilename = resolve((<GCSBucketOptions> options).keyFilename);
    this.storage = new Storage({
      keyFilename
    });
  }

  async uploadFile(bucketName: string, filePath: string, destination?: string): Promise<BucketProviderResponse> {
    if (!bucketName || !filePath) {
      throw new Error('Invalid parameters');
    }
    let bucket = this.storage.bucket(bucketName);
    destination = destination || basename(filePath);
    await bucket.upload(filePath, { destination });
    return {
      status: 200,
      message: `File "${filePath}" was uploaded successfully to bucket "${bucketName}"`,
    }
  }

  async downloadFile(bucketName:string, remoteFilename: string, downloadedFilePath: string): Promise<BucketProviderResponse> {
    if (!bucketName || !remoteFilename || !downloadedFilePath) {
      throw new Error('Invalid parameters');
    }
    let bucket = this.storage.bucket(bucketName);
    let file = bucket.file(remoteFilename);
    await file.download({ destination: downloadedFilePath });
    return {
      status: 200,
      message: `File "${remoteFilename}" was downloaded successfully from bucket "${bucketName}"`,
    }
  };
};