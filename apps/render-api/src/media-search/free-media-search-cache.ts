import type { FreeMediaResult } from './free-media-result';

export const FREE_MEDIA_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

export interface FreeMediaSearchCache {
  readonly store: (slug: string, results: readonly FreeMediaResult[], nowMs: number) => void;
  readonly resolve: (slug: string, resultId: string, nowMs: number) => FreeMediaResult | null;
}

interface FreeMediaSearchCacheRecord {
  readonly expiresAtMs: number;
  readonly byResultId: ReadonlyMap<string, FreeMediaResult>;
}

export function createFreeMediaSearchCache(ttlMs: number = FREE_MEDIA_SEARCH_CACHE_TTL_MS): FreeMediaSearchCache {
  const bySlug = new Map<string, FreeMediaSearchCacheRecord>();

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
