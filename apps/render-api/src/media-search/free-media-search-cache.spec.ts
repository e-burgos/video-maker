import { describe, expect, it } from 'vitest';

import type { FreeMediaResult } from './free-media-result';
import { createFreeMediaSearchCache } from './free-media-search-cache';

const RESULT: FreeMediaResult = {
  resultId: 'commons-video-abc123',
  source: 'commons',
  kind: 'video',
  title: 'Ocean Waves.webm',
  license: 'CC BY 3.0',
  author: 'Jane Doe',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.webm',
  downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.webm',
  durationMs: 5000,
  width: null,
  height: null,
};

describe('createFreeMediaSearchCache', () => {
  it('resolves a stored result for the same slug', () => {
    const cache = createFreeMediaSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1500)).toEqual(RESULT);
  });

  it('is a cache miss for an unknown resultId', () => {
    const cache = createFreeMediaSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', 'commons-video-unknown', 1500)).toBeNull();
  });

  it('is a cache miss for a different project slug', () => {
    const cache = createFreeMediaSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('another-project', RESULT.resultId, 1500)).toBeNull();
  });

  it('is a cache miss once the TTL has elapsed', () => {
    const cache = createFreeMediaSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1000 + 60_000)).toBeNull();
  });

  it('is a cache miss when nothing was ever stored for the slug', () => {
    const cache = createFreeMediaSearchCache(60_000);
    expect(cache.resolve('pitch-deck', RESULT.resultId, 1000)).toBeNull();
  });

  it('a fresh search replaces the previous cache entry for the same slug', () => {
    const cache = createFreeMediaSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);
    cache.store('pitch-deck', [], 1200);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1300)).toBeNull();
  });
});
