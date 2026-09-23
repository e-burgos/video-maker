import type { CommonsMusicResult } from './commons-music-search';

export const MUSIC_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

export interface MusicSearchCache {
  readonly store: (slug: string, results: readonly CommonsMusicResult[], nowMs: number) => void;
  readonly resolve: (slug: string, resultId: string, nowMs: number) => CommonsMusicResult | null;
}

interface MusicSearchCacheRecord {
  readonly expiresAtMs: number;
  readonly byResultId: ReadonlyMap<string, CommonsMusicResult>;
}

export function createMusicSearchCache(ttlMs: number = MUSIC_SEARCH_CACHE_TTL_MS): MusicSearchCache {
  const bySlug = new Map<string, MusicSearchCacheRecord>();

  return {
    store: (slug, results, nowMs) => {
      bySlug.set(slug, {
        expiresAtMs: nowMs + ttlMs,
        byResultId: new Map(results.map((result) => [result.resultId, result])),
      });
    },

    resolve: (slug, resultId, nowMs) => {
      const record = bySlug.get(slug);
      if (record === undefined) {
        return null;
      }
      if (record.expiresAtMs <= nowMs) {
        bySlug.delete(slug);
        return null;
      }
      return record.byResultId.get(resultId) ?? null;
    },
  };
}
