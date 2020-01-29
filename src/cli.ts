#!/usr/bin/env node
require('colors');
import program from 'commander';
import { resolve, relative } from 'path';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { SnapshotCache, ReporterArgs, BucketProviderResponse, BucketProviderType, BucketOptions, BucketProvider, DiffOutput } from './types';
import { imageComparison, fetchImagesForDiffs, generateDiffImages } from './imageComparison.js';
import copydir from 'copy-dir';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import getBucketProvider from './bucketProviders';

program.version('0.0.0');

program.command('compare [target]')
  .description('Compares snapshot images that were `push`ed with <target> against local')
  .option('-c, --config-file <configFilePath>', 'config file location, default process.cwd + \'/snapdiff.json\'')
  .option('-r, --reporter <reporterPackageName>', 'name of the package to use generate report')
  .action(wrapAsyncErrorHandling(async (target: string = 'master', options: { configFile?: string, reporter?: string }) => {
    const configFileLoc = resolve(options.configFile || 'snapdiff.json');
    const reporter = options.reporter || './simpleReporter.js';
    const config = loadConfig(configFileLoc);

    const bp = getBucketProvider(config.bucketProvider.name, config.bucketProvider.options);

    console.log(`☎️\t Fetching remote target ${target} metadata from ${config.bucketProvider.name}`);
    await bp.downloadFile(config.bucketName, `meta/${target}.json`,`${config.localFolder}/meta/${target}.json`);
    const remoteCache = readJSON<SnapshotCache>(`${config.localFolder}/meta/${target}.json`);
    const localCache = readJSON<SnapshotCache>(`${config.localFolder}/meta/local-snapdiff.json`);
  
    console.log(`🖥\t Computing diffs between local and remote`);
  
    const diffs = imageComparison(localCache, remoteCache);
    if (diffs.imageDiffs.length) {
      console.log(`☎️\t Fetching images for diffs from ${config.bucketProvider.name}`);
      await fetchImagesForDiffs(diffs.imageDiffs.map(id => id.expected), bp, config);
      console.log(`📸\t Creating image diffs`);
      generateDiffImages(diffs.imageDiffs, config);
    }
    write(`${config.localFolder}/meta/diffs.json`, JSON.stringify(diffs, null, 2));

    if (diffs.imageDiffs.length === 0 && diffs.addedImages.length === 0 && diffs.addedTests.length === 0 && diffs.removedImages.length === 0 && diffs.removedTests.length === 0) {
      console.log(`💯\t No image differences found!`);
    } else {
      console.log(`
Comparison results:
Changed images: ${diffs.imageDiffs.length},
Added tests:    ${diffs.addedTests.length},
Added images:   ${diffs.addedImages.length},
Removed tests:  ${diffs.removedTests.length},
Removed images: ${diffs.removedImages.length},
`);
    const reporterInstance = require(reporter);
    rimraf.sync(`${config.localFolder}/report-local`);
    mkdirp.sync(`${config.localFolder}/report-local`);
    const reporterArgs: ReporterArgs = {
      diff: diffs,
      diffFileName:`diffs.json`,
      folderPath: `${config.localFolder}`,
      reportFolderPath: `${config.localFolder}/report-local`,
      actual: localCache,
      expected: remoteCache,
      actualFileName: 'local-snapdiff.json',
      expectedFileName: `${target}.json`,      
    }
    console.log(reporterInstance);
    const realReporter = reporterInstance.default || reporterInstance;
    realReporter(reporterArgs);
    console.log(`✅\t Wrote report to ${config.localFolder}/report-local}`)
  }
}));

program.command('push <target>')
  .description('Pushes generated comparison files to a bucket')
  .option('-c, --config-file <configFilePath>', 'config file location, default: process.cwd + \'/snapdiff.json\'')
  .action(wrapAsyncErrorHandling( async (target: string, options: { configFile?: string }) => {
    const configFileLoc = resolve(options.configFile || 'snapdiff.json');
    const config = loadConfig(configFileLoc);
    if (!existsSync(resolve(`${config.localFolder}/report-local`))) {
      console.log(`💣\t No report info found, run 'compare' command before pushing`);
      process.exit(1);
    }
    const bp = getBucketProvider(config.bucketProvider.name, config.bucketProvider.options);
    const local = read(`${config.localFolder}/meta/local-snapdiff.json`);
    const diffs = readJSON<DiffOutput>(`${config.localFolder}/meta/diffs.json`);
    write(`${config.localFolder}/meta/${target}.json`, local);

    const localCache: SnapshotCache = <SnapshotCache>JSON.parse(local);
    const imageUploadPromises: Promise<BucketProviderResponse>[] = [];

    Object.keys(localCache).forEach(k => {
      localCache[k].images.forEach(img => {
        imageUploadPromises.push(bp.uploadFile(config.bucketName, `${config.localFolder}/images/${img}.png`, `images/${img}.png`));
      });
    });
    diffs.imageDiffs.map((imageDiff) => {
      const diffPath = `images/${imageDiff.actual}-${imageDiff.expected}.png`;
      imageUploadPromises.push(bp.uploadFile(config.bucketName, `${config.localFolder}/${diffPath}`, diffPath));
    });
    console.log(`☎️\t Pushing build ${target} with ${imageUploadPromises.length} images to ${config.bucketProvider.name}`);
    await Promise.all([ 
      bp.uploadFile(config.bucketName, `${config.localFolder}/meta/${target}.json`, `meta/${target}.json`),
      ...imageUploadPromises,
    ]);
    console.log(`☎️\t Uploading report contents to ${config.bucketProvider.name}`);
    await Promise.all(uploadAllInFolder(bp, config, `${config.localFolder}/report-local`));
    console.log(`💯\t Push complete!`);
  }))

function wrapAsyncErrorHandling(fn: (...args: any) => Promise<any>) {
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

function loadConfig(path: string) : Config {
  const defaults = {
    bucketName: 'snaps',
    localFolder: 'snaps',
  }
  const cfg = readJSON<Config>(path);
  return { ...defaults, ...cfg };
}


type Config = {
  bucketProvider: {
    name: BucketProviderType,
    options: BucketOptions,
  }
  bucketName: string,
  localFolder: string,
}
 
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

function read(fileName: string): string {
  return readFileSync(resolve(fileName), { encoding: 'utf8' });
}

function write(fileName: string, content: string) {
  return writeFileSync(resolve(fileName), content, { encoding: 'utf8' });
}

function copy(from: string, to: string) {
  if (statSync(from).isDirectory()) {
    copydir.sync(from, to);
  } else {
    write(to, read(from));
  } 
}

function uploadAllInFolder(bp: BucketProvider, config: Config, folder: string): Promise<BucketProviderResponse>[] {
  const resolvedFolder = resolve(folder);
  const files = readdirSync(resolvedFolder, { encoding: 'utf8' });
  console.log(resolvedFolder, files);
  const destinationPrefix = relative(config.localFolder, folder);
  return files.map((f) => {
    console.log(`uploading file from: ${resolvedFolder}/${f} to: ${destinationPrefix}/${f}`);
    return bp.uploadFile(config.bucketName, `${resolvedFolder}/${f}`, `${destinationPrefix}/${f}`);
  });
}

function readJSON<T>(fileName: string): T {
  return <T> JSON.parse(read(fileName));
} 