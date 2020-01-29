
export type Options = {
  folderPath: string,
}

export type SnapshotCache = {
  [key: string]: {
    images : Array<string>,
    context: Context,
  },
}

export type Context = {
  title: string,
  fullTitle: string,
  file: string,
}

export type RecordSnapshotOptions = {
  hash: string,
  testContext: Context
}

export type ImageDiff = {
  context: Context,
  expected: string,
  actual: string,
}

export type ImageAddDelete = {
  image: string,
  context: Context,
}

export type TestAddDelete = {
  images: string[],
  context: Context,
}

export type DiffOutput = {
  time: number,
  addedTests: TestAddDelete[],
  removedTests: TestAddDelete[],
  imageDiffs: Array<ImageDiff>,
  addedImages: Array<ImageAddDelete>,
  removedImages: Array<ImageAddDelete>,
}

export type ReporterArgs = {
  folderPath: string,
  reportFolderPath: string,
  diffFileName: string,
  expectedFileName: string,
  actualFileName: string,
  diff: DiffOutput,
  expected: SnapshotCache,
  actual: SnapshotCache,
}

export type ReporterResult = {
  reportFileOrFolder: string,
  shouldUploadOnPush: boolean,
  additionalFilesToUpload: string[],
}

export type BucketProviderType = 'gcs' | 'folder'; //| 's3' ;

export type BucketOptions = GCSBucketOptions | FolderBucketOptions
export type GCSBucketOptions = {
  keyFilename : string 
}
export type FolderBucketOptions = {
  folderPath: string 
}
export type BucketProviderResponse = {
  status: number,
  message?: string,
}

export interface BucketOptionsCtor {
  new (options: BucketOptions): BucketProvider;
}
export interface BucketProvider {
  uploadFile(bucketName: string, filePath: string, destination?: string): Promise<BucketProviderResponse>;
  downloadFile(bucketName:string, remoteFilename: string, downloadedFilePath: string): Promise<BucketProviderResponse>;
}