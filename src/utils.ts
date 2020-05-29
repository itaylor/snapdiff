import { resolve, relative } from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { BucketProviderResponse, BucketProvider, Config } from './types';

export function wrapAsyncErrorHandling(fn: (...args: any) => Promise<any>) {
  return async (...args: any) => {
    let retval;
    try {
      retval = await fn(...args);
    } catch (e) {
      console.error(e, e.message, e.stack);
      process.exit(1);
    }
    return retval;
  }
}

export function loadConfig(path: string) : Config {
  const defaults = {
    bucketName: 'snaps',
    localFolder: 'snaps',
  }
  const cfg = readJSON<Config>(path);
  return { ...defaults, ...cfg };
}

export function read(fileName: string): string {
  return readFileSync(resolve(fileName), { encoding: 'utf8' });
}

export function write(fileName: string, content: string) {
  return writeFileSync(resolve(fileName), content, { encoding: 'utf8' });
}

export function uploadToShaFolder(bp: BucketProvider, config: Config, commit: string): Promise<BucketProviderResponse>[] {
  if (!config.errorOutput) {
    console.warn('Without an "errorOutput" in your config, no files can be uploaded.')
    return []
  }
  const resolvedFolder = resolve(config.errorOutput);
  const files = readdirSync(resolvedFolder, { encoding: 'utf8' });
  return files.map((f) => {
    return bp.uploadFile(config.bucketName, `${resolvedFolder}/${f}`, `${commit}/${f}`);
  });
}

export function uploadAllInFolder(bp: BucketProvider, config: Config, folder: string): Promise<BucketProviderResponse>[] {
  const resolvedFolder = resolve(folder);
  const files = readdirSync(resolvedFolder, { encoding: 'utf8' });
  console.log(resolvedFolder, files);
  const destinationPrefix = relative(config.localFolder, folder);
  return files.map((f) => {
    return bp.uploadFile(config.bucketName, `${resolvedFolder}/${f}`, `${destinationPrefix}/${f}`);
  });
}

export function readJSON<T>(fileName: string): T {
  return <T> JSON.parse(read(fileName));
}