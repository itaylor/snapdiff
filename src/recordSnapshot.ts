import { SnapshotCache, RecordSnapshotOptions, Context } from './types';

const snapshots:SnapshotCache = {}
export function recordSnapshot({
  hash,
  testContext,
}: RecordSnapshotOptions) {
  const fullName = testContext.fullTitle;
  if (!snapshots[fullName]) {
    snapshots[fullName] = {
      images: [hash],
      context: testContext,
    };
  } else {
    snapshots[fullName].images.push(hash);
  }
}

export function getSnapshots(): SnapshotCache {
  return snapshots;
}
