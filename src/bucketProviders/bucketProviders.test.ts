import getBucketProvider from './index';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import fs from 'fs';

describe('bucketProviders', () => {
  beforeAll(() => {
    rimraf.sync('junk');
    mkdirp.sync('junk');
  })
  afterAll(() => {
    rimraf.sync('junk');
  });
  test('solid bucket upload to folder with gcs', async () => {
    const bp = getBucketProvider('gcs', { keyFilename: '../../snapdiff-gcs.json' });
    await bp.uploadFile('mkto-snapdiff-test', `tsconfig.json`, 'foo/bar/tsconfig.json');
    await bp.downloadFile('mkto-snapdiff-test', 'foo/bar/tsconfig.json', 'junk/tsconfig.json');
    expect(fs.existsSync('junk/tsconfig.json')).toBe(true);
  })
  test('solid bucket upload to folder with filesystem', async () => {
    const sb = getBucketProvider('folder', { folderPath: 'junk' });
    await sb.uploadFile('mkto-snapdiff-test', `tsconfig.json`, 'foo/bar/tsconfig.json');
    await sb.downloadFile('mkto-snapdiff-test', 'foo/bar/tsconfig.json', 'junk/tsconfig.json');
    expect(fs.existsSync('junk/tsconfig.json')).toBe(true);
  })
})


