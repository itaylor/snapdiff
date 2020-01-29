require('../snapdiff-tests/example.test.js');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
import { execSync } from 'child_process';
import { resolve } from 'path';
import { readdirSync } from 'fs';

describe('snapshot cli util', () => {
  test('compare', () => {
    const output = execSync('node build/cli.js compare -c src/fixtures/snapdiff-fs-compare.json basictest', { 
      cwd: resolve(__dirname + '/../'),
      encoding: 'utf8',
    });
    expect(output).toMatchSnapshot();
    expect(readdirSync('src/fixtures/fake-compare', { encoding: 'utf8' })).toMatchSnapshot();
// @ts-ignore
  }).timeout(10000); 

  test('push', () => {
    const testFolder = 'src/fixtures/fake-push'
    rimraf.sync(testFolder);
    mkdirp.sync(testFolder);
    const output = execSync('node build/cli.js push -c src/fixtures/snapdiff-fs-push.json basictest', { 
      cwd: resolve(__dirname + '/../'),
      encoding: 'utf8',
    });
    const pushedFolders = readdirSync(testFolder, { encoding: 'utf8' });
    expect(pushedFolders).toMatchSnapshot();
    const pushedImages = readdirSync(`${testFolder}/images`, { encoding: 'utf8' });
    expect(pushedImages.filter(f => f.endsWith('.png') ).length).toBe(3);
// @ts-ignore
  }).timeout(10000);

});