import { ErrorSnapConfig, BucketProvider } from '../types';
import { writeFileSync, statSync } from 'fs';
import { resolve } from 'path';

interface UploadConfig {
  folderRoot: string
  bucketRoot: string
  localPath: string
}

export default async function generateFailureHtml(errorFolderPath: string, commit: string, errorConfig: ErrorSnapConfig[], bp: BucketProvider) {
  const uploadConfig : UploadConfig = {
    folderRoot: commit,
    bucketRoot: bp.getBaseUrl(),
    localPath: errorFolderPath,
  }
  const str = `${buildHead(commit)}${buildBody(errorConfig, uploadConfig)}${buildFoot()}`
  writeFileSync(`${errorFolderPath}/index.html`, str, { encoding: 'utf8' });
  return `${uploadConfig.bucketRoot}/${uploadConfig.folderRoot}/index.html`
}

function buildHead(commit : string) {
  return `<doctype html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>A Listing of Test Failures for ${commit}</title>
  </head>
  <body>`
}

function buildBody(errors: ErrorSnapConfig[], uploadConfig: UploadConfig) {
  return `  <h2>Failed Tests</h2>
  ${join(errors.map((errorConf : ErrorSnapConfig) => errorDiff(uploadConfig, errorConf)))}`;
}

function join(arr: string[]) {
  return arr.join('\n');
}

function errorDiff(uploadConfig : UploadConfig, diff: ErrorSnapConfig) {
  const  {
    folderRoot,
    bucketRoot,
    localPath
  } = uploadConfig
  let rawErrors
  if (statSync(resolve(localPath, diff.json))) {
    rawErrors = require(resolve(localPath, diff.json))
  }
  const builtTitle = diff.img.split('.')[0].split('-').join(' ')
  return `  <h3>${builtTitle}</h3>
  <img src='${bucketRoot}/${folderRoot}/${diff.img}' style="max-width: 98vw">
  ${rawErrors && `  <h3>Errors for: ${builtTitle}</h3><pre style="max-height: 350px; overflow: scroll;">${JSON.stringify(rawErrors, null, 2)}</pre>`}`
}

function buildFoot() {
  return `</body></html>`
}
