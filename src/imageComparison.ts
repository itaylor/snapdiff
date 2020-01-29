import { SnapshotCache, DiffOutput, ImageDiff, BucketProvider, BucketProviderResponse } from './types';
import { diff } from 'deep-diff';
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';


export function imageComparison(actual: SnapshotCache, expected: SnapshotCache)  {
  const output = diff<SnapshotCache, SnapshotCache>(expected, actual);

  const results: DiffOutput = { 
    time: new Date().getTime(),
    addedTests: [],
    removedTests: [],
    imageDiffs: [],
    addedImages: [],
    removedImages: [],
  }

  if (output) {
    for (const o of output) {
      const path = (<Array<string>> o.path) || [];
      if (o.kind === 'N') {
        if (path.length === 1 ) {
          results.addedTests.push(actual[path[0]]);
        }
      } else if (o.kind === 'A' && path[1] === 'images') {
        if (o.item.kind === 'N') {
          results.addedImages.push({
            context: actual[path[0]].context,
            image: <string> <unknown>o.item.rhs,
          });
        } else if (o.item.kind === 'D') {
          results.removedImages.push({
            context: expected[path[0]].context,
            image: <string> <unknown>o.item.lhs,
          });
        }
      } else if (o.kind === 'D' && path.length === 1) {
        results.removedTests.push(expected[path[0]]);
      } else if (o.kind === 'E' && path[1] === 'images') {
        results.imageDiffs.push({ 
          expected: <string> <unknown> o.lhs,
          actual: <string> <unknown> o.rhs,
          context: actual[path[0]].context,
        });
      }
    }
  }
  return results;
}

export async function fetchImagesForDiffs(images: Array<string>, bp: BucketProvider, bpConfig: { bucketName: string, localFolder: string } ): Promise<BucketProviderResponse[]> {
  const { bucketName, localFolder } = bpConfig;
  return Promise.all(
    images.map(imgSha => 
      bp.downloadFile(bucketName, `images/${imgSha}.png`, `${localFolder}/images/${imgSha}.png`)
    )
  )
}

export function generateDiffImages(images: Array<ImageDiff>, config: { localFolder: string }): Array<string> {
  return images.map(img => generateDiffImage(img, config));
} 

function generateDiffImage(diffDescriptor: ImageDiff, config: { localFolder: string }): string {
  const { localFolder } = config;  
  const rawReceivedImage = PNG.sync.read(readFileSync(`${localFolder}/images/${diffDescriptor.actual}.png`));
  const rawBaselineImage = PNG.sync.read(readFileSync(`${localFolder}/images/${diffDescriptor.expected}.png`));
  const hasSizeMismatch = (
    rawReceivedImage.height !== rawBaselineImage.height ||
    rawReceivedImage.width !== rawBaselineImage.width
  );
  // Align images in size if different
  const [receivedImage, baselineImage] = hasSizeMismatch
    ? alignImagesToSameSize(rawReceivedImage, rawBaselineImage)
    : [rawReceivedImage, rawBaselineImage];
  const imageWidth = receivedImage.width;
  const imageHeight = receivedImage.height;

  const diffImage = new PNG({ width: imageWidth, height: imageHeight });

  pixelmatch(
    receivedImage.data,
    baselineImage.data,
    diffImage.data,
    imageWidth,
    imageHeight,
    { threshold: 0 }
  );

  const totalWidth = baselineImage.width + diffImage.width + receivedImage.width;
  const totalHeight = Math.max(baselineImage.height, diffImage.height, receivedImage.height);

  const compositeResultImage = new PNG({
    width: totalWidth,
    height: totalHeight,
  });
  let offsetWidth = 0;
  for (const img of [baselineImage, diffImage, receivedImage]) {
    PNG.bitblt(img, compositeResultImage, 0, 0, img.width, img.height, offsetWidth, 0);
    offsetWidth += img.width;
  }
  
  // Set filter type to Paeth to avoid expensive auto scanline filter detection
  // For more information see https://www.w3.org/TR/PNG-Filters.html
  const pngBuffer = PNG.sync.write(compositeResultImage, { filterType: 4 });
  const fName = `${localFolder}/images/${diffDescriptor.actual}-${diffDescriptor.expected}.png`;
  writeFileSync(fName, pngBuffer);
  return fName;
}
/**
 * Aligns images sizes to biggest common value
 * and fills new pixels with transparent pixels
 */
function alignImagesToSameSize(firstImage: PNG, secondImage: PNG): [ PNG, PNG ] {
  // Keep original sizes to fill extended area later
  const firstImageWidth = firstImage.width;
  const firstImageHeight = firstImage.height;
  const secondImageWidth = secondImage.width;
  const secondImageHeight = secondImage.height;
  // Calculate biggest common values
  const resizeToSameSize = createImageResizer(
    Math.max(firstImageWidth, secondImageWidth),
    Math.max(firstImageHeight, secondImageHeight)
  );
  // Resize both images
  const resizedFirst = resizeToSameSize(firstImage);
  const resizedSecond = resizeToSameSize(secondImage);
  // Fill resized area with black transparent pixels
  return [
    fillSizeDifference(firstImageWidth, firstImageHeight)(resizedFirst),
    fillSizeDifference(secondImageWidth, secondImageHeight)(resizedSecond),
  ];
};

/**
 * Helper function to create reusable image resizer
 */
const createImageResizer = (width: number, height: number) => (source: PNG) => {
  const resized = new PNG({ width, height, fill: true });
  PNG.bitblt(source, resized, 0, 0, source.width, source.height, 0, 0);
  return resized;
};

/**
 * Fills diff area with black transparent color for meaningful diff
 */
const fillSizeDifference = (width: number, height:number) => (image: PNG) => {
  const inArea = (x: number, y: number ) => y > height || x > width;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (inArea(x, y)) {
        const idx = ((image.width * y) + x) << 2;
        image.data[idx] = 0;
        image.data[idx + 1] = 0;
        image.data[idx + 2] = 0;
        image.data[idx + 3] = 64;
      }
    }
  }
  return image;
};