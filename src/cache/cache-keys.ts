function sequencePart(asOfSequence?: string): string {
  return asOfSequence !== undefined ? `seq:${asOfSequence}` : 'latest';
}

export function aggregateStateCacheKey(
  aggregateId: string,
  asOfSequence?: string,
): string {
  return `aggregate-state:${aggregateId}:${sequencePart(asOfSequence)}`;
}

export function snapshotLookupCacheKey(
  aggregateId: string,
  asOfSequence?: string,
): string {
  return `snapshot-lookup:${aggregateId}:${sequencePart(asOfSequence)}`;
}

export function aggregateStateLatestKey(aggregateId: string): string {
  return aggregateStateCacheKey(aggregateId);
}

export function snapshotLookupLatestKey(aggregateId: string): string {
  return snapshotLookupCacheKey(aggregateId);
}
