import { ReporterArgs, ReporterResult, ImageDiff, ImageAddDelete, TestAddDelete, DiffOutput } from './types';
import { writeFileSync } from 'fs';

export default async function simpleReporter(reporterArgs: ReporterArgs) {

  const {
    folderPath,
    reportFolderPath,
    diff,
  } = reporterArgs;

  const str = `${buildHead()}
${buildBody(diff)}
${buildFoot()}
`
  writeFileSync(`${reportFolderPath}/index.html`, str, { encoding: 'utf8' });
}



function buildHead() {
  return `<doctype html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>Image comparison</title>
  </head>
  <body>
`}

function buildBody(diff: DiffOutput) {
  return `
  <h2>Changed Images</h2>
  ${join(diff.imageDiffs.map(imageDiff))}
  <h2>Added Images</h2>
  ${join(diff.addedImages.map(imageAddDelete))}
  <h2>Removed Images</h2>
  ${join(diff.removedImages.map(imageAddDelete))}
  <h2>Added Tests<h2>
  ${join(diff.addedTests.map(testAddDelete))}
  <h2>Removed Tests</h2>
  ${join(diff.removedTests.map(testAddDelete))}
  `;
}

function join(arr: string[]) {
  return arr.join('\n');
}

function imageDiff(diff: ImageDiff) {
  return `
  <h3>${diff.context.fullTitle}</h3>
  <img src='../images/${getImageComparisonPath(diff)}'>
  `
}

function imageAddDelete(img: ImageAddDelete) {
  return `
  <h3>${img.context.fullTitle}</h3>
  <img src='../images/${img.image}.png' >
  `
}

function testAddDelete(test: TestAddDelete) {
  return join(test.images.map(image => imageAddDelete({ context: test.context, image })));
}

function buildFoot() {
  return `</body></html>`
}

function getImageComparisonPath(diff: ImageDiff) {
  return `${diff.actual}-${diff.expected}.png`
}