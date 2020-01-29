import { BucketProviderType, BucketProvider, BucketOptions } from '../types';
import { GCSBucketProvider } from './gcs';
import { FolderBucketProvider } from './folder';

export default function getBucketProvider(name: BucketProviderType, options: BucketOptions) : BucketProvider {
  if (name === 'gcs') {
    return new GCSBucketProvider(options);
  } // else if (name === 'folder') {
  return new FolderBucketProvider(options);
}