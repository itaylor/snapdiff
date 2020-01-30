import { Page as IPage } from 'puppeteer';
// @ts-ignore 
import { Page } from 'puppeteer/lib/Page';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { getTestContext } from './mochaAdapter';
import { recordSnapshot, getSnapshots } from './recordSnapshot';
import { Options,Context } from './types';
import mkdirp from 'mkdirp';

let config: Options = {
  folderPath: process.cwd() + '/snaps',
};

function init() {
  if (needsInit) {
    mkdirp.sync(`${config.folderPath}/images/`);
    mkdirp.sync(`${config.folderPath}/meta/`);
  }
  needsInit = false;
}
let needsInit: boolean = true;

Page.prototype.snap = async function snap(selector?: string) : Promise<IPage> {
  init();
  let scr;
  if (selector) {
    const e = await this.$(selector);
    scr = e.screenshot();
  } else {
    scr = await this.screenshot();
  } 
  const hash = createHash('sha256').update(scr).digest('hex');
  writeFileSync(`${config.folderPath}/images/${hash}.png`, scr);
  recordSnapshot({
    hash,
    testContext: <Context> getTestContext(),
  });
  return this;
}

Page.prototype.hideElem = async function hideElem(selector: string) : Promise<IPage> {
  const elemsToHide = await(<IPage>this).$$(selector);
  await Promise.all(elemsToHide.map(elem => elem.evaluate(e => (<HTMLElement> e).style.visibility = 'hidden')));
  return this;
} 

export function setConfig(_config: Options) {
  config = _config;
  needsInit = true;
}

export function writeSnapCache() {
  init();
  const snaps = getSnapshots();
  writeFileSync(`${config.folderPath}/meta/local-snapdiff.json`, JSON.stringify(snaps, null, 2), { encoding: 'utf8' });
}