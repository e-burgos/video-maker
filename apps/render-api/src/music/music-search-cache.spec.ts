import { describe, expect, it } from 'vitest';

import type { CommonsMusicResult } from './commons-music-search';
import { createMusicSearchCache } from './music-search-cache';

const RESULT: CommonsMusicResult = {
  resultId: 'commons-abc123',
  title: 'Calm Piano.mp3',
  durationMs: 120000,
  license: 'CC BY 3.0',
  author: 'Jane Doe',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
  downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Calm_Piano.mp3',
};

describe('createMusicSearchCache', () => {
  it('resolves a stored result for the same slug', () => {
    const cache = createMusicSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1500)).toEqual(RESULT);
  });

  it('is a cache miss for an unknown resultId', () => {
    const cache = createMusicSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', 'commons-unknown', 1500)).toBeNull();
  });

  it('is a cache miss for a different project slug', () => {
    const cache = createMusicSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('another-project', RESULT.resultId, 1500)).toBeNull();
  });

  it('is a cache miss once the TTL has elapsed', () => {
    const cache = createMusicSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1000 + 60_000)).toBeNull();
  });

  it('is a cache miss when nothing was ever stored for the slug', () => {
    const cache = createMusicSearchCache(60_000);
    expect(cache.resolve('pitch-deck', RESULT.resultId, 1000)).toBeNull();
  });

  it('a fresh search replaces the previous cache entry for the same slug', () => {
    const cache = createMusicSearchCache(60_000);
    cache.store('pitch-deck', [RESULT], 1000);
    cache.store('pitch-deck', [], 1200);

    expect(cache.resolve('pitch-deck', RESULT.resultId, 1300)).toBeNull();
  });
});
