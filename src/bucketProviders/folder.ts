import { BucketProvider, BucketOptions, FolderBucketOptions, BucketProviderResponse } from '../types';
import { resolve, join, dirname, basename } from 'path';
import { Stream } from 'stream';
import { WriteStream, createWriteStream, createReadStream } from 'fs';
import mkdirp from 'mkdirp';

export class FolderBucketProvider implements BucketProvider {
  private rootFolder: string;
  constructor (options: BucketOptions) {
    this.rootFolder = resolve((<FolderBucketOptions> options).folderPath);
  }

  getBaseUrl() {
    return this.rootFolder;
  }

  async uploadFile(bucketName: string, filePath: string, destination?: string): Promise<BucketProviderResponse> {
    if (!bucketName || !filePath) {
      throw new Error('Invalid parameters');
    }
    let filename = destination || basename(filePath);
    if (destination && destination.includes('/')) {
      mkdirp.sync(join(this.rootFolder, bucketName, dirname(destination)));
    }
    let source = createReadStream(filePath);
    let dest = createWriteStream(
      join(this.rootFolder, bucketName, filename)
    );

    const status = await readStreamToEnd(source, dest);
    return {
      status,
      message: `File "${filePath}" was uploaded successfully to bucket "${bucketName}"`,
    }
  }

  async downloadFile(bucketName:string, remoteFilename: string, downloadedFilePath: string): Promise<BucketProviderResponse> {
    if (!bucketName || !remoteFilename || !downloadedFilePath) {
      throw new Error('Invalid parameters');
    }
    let source = createReadStream(
      join(this.rootFolder, bucketName, remoteFilename)
    );
    let dest = createWriteStream(downloadedFilePath);
    const status = await readStreamToEnd(source, dest);
    return {
      status,
      message: `File "${remoteFilename}" was downloaded successfully from bucket "${bucketName}"`,
    }
  };
};

function readStreamToEnd(source:Stream, dest:WriteStream): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    source.on('end', () => resolve(200));
    source.on('error', reject);
    source.pipe(dest);
  })
}