const puppeteer = require('puppeteer');
const { resolve } = require('path');
const { spawn } = require('child_process');
const { writeSnapCache } = require('../build/snapdiff.js');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

let browser;
let page;
let testAppProcess;
const snapsFolder = resolve(`${__dirname}/../snaps`);

describe('basic test', () => {
  beforeAll(async function () {
    this.timeout(30000);
    rimraf.sync(snapsFolder);
    mkdirp.sync(`${snapsFolder}/images`);
    mkdirp.sync(`${snapsFolder}/meta`);
    browser = await puppeteer.launch();
    page = await browser.newPage();
    await waitForDevServerToStart();
    await page.goto('http://localhost:3000/');
    await page.hideElem('.App-logo');
    await page.snap();
  });
  afterAll(async () => {
    await page.snap();
    writeSnapCache();
    await browser.close();
    process.kill(-testAppProcess.pid);
  })
  beforeEach(async () => {
    await page.snap();
  })
  afterEach(async () => {
    await page.snap();
  })
  test('super rad', async () => {
    await page.snap();
  })
  test('another test', async () => {
    await page.snap();
  })
  test('rando always different test', async () => {
    await page.evaluate(() => {
      function rando(min = 50, max = 200) {
        return Math.round(min + (Math.random() * (max - min)));
      }
      const elem = document.createElement('div');
      elem.style.width = `${rando()}px`;
      elem.style.height = `${rando()}px`;
      elem.style.marginLeft = `${rando()}px`;
      elem.style.marginTop = `${rando()}px`;
      elem.style.position = 'absolute';
      elem.style.backgroundColor = 'green';
      const root = document.getElementById('root');
      root.insertBefore(elem, root.firstChild);
    });
    await page.snap();
  })
})

function waitForDevServerToStart() {
  return new Promise((res, rej) => {
    testAppProcess = spawn('yarn', ['start'], { cwd: resolve(__dirname + '/../test-app'), detached: true });

    testAppProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      if (data.includes('Project is running at')) {
        res();
      }
    });

    testAppProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    testAppProcess.on('close', (code) => {
      rej(new Error('Closed dev server'));
    });
  });
}