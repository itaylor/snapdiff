#!/usr/bin/env node
require('colors');
import program from 'commander';
import { resolve } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { SnapshotCache, ReporterArgs, BucketProviderResponse, DiffOutput, ErrorSnapConfig } from './types';
import { imageComparison, fetchImagesForDiffs, generateDiffImages } from './imageComparison.js';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import getBucketProvider from './bucketProviders';
import generateFailureHtml from './reporters/failure';
import { wrapAsyncErrorHandling, loadConfig, readJSON, uploadAllInFolder, uploadToShaFolder, read, write } from './utils';
import { cliHandler } from './error';

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

    console.log(`☎️  Fetching remote target ${target} metadata from ${config.bucketProvider.name}`);
    await bp.downloadFile(config.bucketName, `meta/${target}.json`,`${config.localFolder}/meta/${target}.json`);
    const remoteCache = readJSON<SnapshotCache>(`${config.localFolder}/meta/${target}.json`);
    const localCache = readJSON<SnapshotCache>(`${config.localFolder}/meta/local-snapdiff.json`);

    console.log(`🖥  Computing diffs between local and remote`);

    const diffs = imageComparison(localCache, remoteCache);
    if (diffs.imageDiffs.length) {
      console.log(`☎️  Fetching images for diffs from ${config.bucketProvider.name}`);
      await fetchImagesForDiffs(diffs.imageDiffs.map(id => id.expected), bp, config);
      console.log(`📸  Creating image diffs`);
      generateDiffImages(diffs.imageDiffs, config);
    }
    write(`${config.localFolder}/meta/diffs.json`, JSON.stringify(diffs, null, 2));

    if (diffs.imageDiffs.length === 0 && diffs.addedImages.length === 0 && diffs.addedTests.length === 0 && diffs.removedImages.length === 0 && diffs.removedTests.length === 0) {
      console.log(`💯  No image differences found!`);
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
    await realReporter(reporterArgs);
    console.log(`✅  Wrote report to ${config.localFolder}/report-local`)
  }
}));

program.command('push <target>')
  .description('Pushes generated comparison files to a bucket')
  .option('-c, --config-file <configFilePath>', 'config file location, default: process.cwd + \'/snapdiff.json\'')
  .action(wrapAsyncErrorHandling( async (target: string, options: { configFile?: string }) => {
    const configFileLoc = resolve(options.configFile || 'snapdiff.json');
    const config = loadConfig(configFileLoc);
    const hasReport = existsSync(resolve(`${config.localFolder}/report-local`));
    const hasDiffs = existsSync(resolve(`${config.localFolder}/meta/diffs.json`));
    if (!hasReport || !hasDiffs) {
      console.log(`⚠️  No report or no diffs found, you may want to run the 'compare' command first, to push reports along with images`);
    }
    const bp = getBucketProvider(config.bucketProvider.name, config.bucketProvider.options);
    const local = read(`${config.localFolder}/meta/local-snapdiff.json`);
    write(`${config.localFolder}/meta/${target}.json`, local);

    const localCache: SnapshotCache = <SnapshotCache>JSON.parse(local);
    const imageUploadPromises: Promise<BucketProviderResponse>[] = [];

    Object.keys(localCache).forEach(k => {
      localCache[k].images.forEach(img => {
        imageUploadPromises.push(bp.uploadFile(config.bucketName, `${config.localFolder}/images/${img}.png`, `images/${img}.png`));
      });
    });
    if (hasDiffs) {
      const diffs = readJSON<DiffOutput>(`${config.localFolder}/meta/diffs.json`);
      diffs.imageDiffs.map((imageDiff) => {
        const diffPath = `images/${imageDiff.actual}-${imageDiff.expected}.png`;
        imageUploadPromises.push(bp.uploadFile(config.bucketName, `${config.localFolder}/${diffPath}`, diffPath));
      });
    }
    console.log(`☎️  Pushing build ${target} with ${imageUploadPromises.length} images to ${config.bucketProvider.name}`);
    await Promise.all([
      bp.uploadFile(config.bucketName, `${config.localFolder}/meta/${target}.json`, `meta/${target}.json`),
      ...imageUploadPromises,
    ]);
    if (hasReport) {
      console.log(`☎️  Uploading report contents to ${config.bucketProvider.name}`);
      await Promise.all(uploadAllInFolder(bp, config, `${config.localFolder}/report-local`));
    }
    console.log(`💯  Push complete!`);
  }))

program.command('errors <commit>')
  .description('Uploads errors and failure snaps to a bucket for a specific commit')
  .option('-c, --config-file <configFilePath>', 'config file location, default: process.cwd + \'/snapdiff.json\'')
  .action(wrapAsyncErrorHandling(cliHandler))

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}