import { resolve } from 'path';
import { readdirSync, statSync } from 'fs';
import { loadConfig, uploadToShaFolder } from './utils';
import { ErrorSnapConfig } from './types';
import getBucketProvider from './bucketProviders';
import generateFailureHtml from './reporters/failure';

export const cliHandler = async (commit: string, options: { configFile?: string }) => {
  const configFileLoc = resolve(options.configFile || 'snapdiff.json');
  const config = loadConfig(configFileLoc);
  if (!config.errorOutput) {
    console.warn('Without an "errorOutput" in your config, no actions can be performed.')
    return
  }
  const errorFolderStats = statSync(config.errorOutput)
  if (!errorFolderStats.isDirectory) {
    console.warn('The "errorOutput" config must point to a folder with images and json.')
    return
  }
  const allFiles = readdirSync(config.errorOutput)
  const allErrors = allFiles.filter(file => file.endsWith('.png')).reduce((accum: ErrorSnapConfig[], curr) : ErrorSnapConfig[] => {
    const errConf = {
      img: curr,
      json: `${curr.replace('png', 'json')}`
    }
    accum.push(errConf)
    return accum
  }, [])
  const bp = getBucketProvider(config.bucketProvider.name, config.bucketProvider.options);
  const deployedLink = await generateFailureHtml(config.errorOutput, commit, allErrors, bp)
  await(Promise.all(uploadToShaFolder(bp, config, commit)))
  console.log(`check out your errors at ${deployedLink}`)
  return deployedLink
}

export default cliHandler;