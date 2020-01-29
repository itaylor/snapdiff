import { readFileSync } from 'fs';

const a = require('./fixtures/a.json');
const b = require('./fixtures/b.json');
import { PNG } from 'pngjs';
import { createHash } from 'crypto';

const { imageComparison, generateDiffImages } = require('./imageComparison');

describe('imageComparison Diffing', () => {
  test('two identical JSONs have no differences', () => {
    const output = imageComparison(a, a);
    expect(output.addedImages.length).toBe(0);
    expect(output.addedTests.length).toBe(0);
    expect(output.imageDiffs.length).toBe(0);
    expect(output.removedImages.length).toBe(0);
    expect(output.removedTests.length).toBe(0);
  });
  test('Add a test and an image to an existing test', () => {
    const output = imageComparison(b, a);
    expect(output).toMatchSnapshot({ time: expect.any(Number), });
    expect(output.imageDiffs.length).toBe(0);
    expect(output.removedImages.length).toBe(0);
    expect(output.removedTests.length).toBe(0);
    expect(output.addedImages.length).toBe(1);
    expect(output.addedTests.length).toBe(1);
  });
  test('Remove a test and an image from an existing test', () => {
    const output = imageComparison(a, b);
    expect(output).toMatchSnapshot({ time: expect.any(Number), });
    expect(output.imageDiffs.length).toBe(0);
    expect(output.removedImages.length).toBe(1);
    expect(output.removedTests.length).toBe(1);
    expect(output.addedImages.length).toBe(0);
    expect(output.addedTests.length).toBe(0);
  });
  test('generate PNG image diff file', () => {
    const diff = {
      context: { 
        title: 'example test',
        fullTitle: 'example test',
        file: 'whatever.file'
      },
      expected: 'testimage1',
      actual: 'testimage2',
    }
    generateDiffImages( [ diff ], { localFolder: __dirname + '/fixtures/imagediff' } );
    const png = PNG.sync.read(readFileSync(`${__dirname}/fixtures/imagediff/images/testimage2-testimage1-expected.png`));
    const pngNew = PNG.sync.read(readFileSync(`${__dirname}/fixtures/imagediff/images/testimage2-testimage1.png`));
    const hashExpected = createHash('sha256').update(png.data).digest('hex');
    const hashActual = createHash('sha256').update(pngNew.data).digest('hex');
    expect(hashActual).toBe(hashExpected);
  });
});