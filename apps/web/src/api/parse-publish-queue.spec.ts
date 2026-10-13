import { describe, expect, it } from 'vitest';

import {
  parseCategoryPlaylists,
  parsePublishQueue,
  parsePublishQueueAddResult,
  parsePublishQueueItem,
  parseYouTubePlaylistListing,
} from './parse-publish-queue';
import { RenderApiError } from './render-api-error';

const RAW_ITEM = {
  id: 'i1',
  slug: 'demo',
  file: 'out/demo.mp4',
  metadata: { title: 'T', privacy: 'unlisted', playlistIds: ['PL1'], ignoreReview: true },
  position: 2,
  status: 'failed',
  attempts: 1,
  lastError: { code: 'YOUTUBE_UPLOAD_FAILED', message: 'boom', stage: null },
  nextAttemptAt: null,
  jobId: 'job-1',
  url: null,
};

describe('parse publish queue', () => {
  it('normalizes an item and keeps only the known keys', () => {
    const item = parsePublishQueueItem({ ...RAW_ITEM, extra: 1 });

    expect(Object.keys(item).sort()).toEqual([
      'attempts',
      'file',
      'id',
      'jobId',
      'lastError',
      'metadata',
      'nextAttemptAt',
      'position',
      'slug',
      'status',
      'url',
    ]);
    expect(Object.keys(item.metadata).sort()).toEqual([
      'description',
      'ignoreReview',
      'playlistIds',
      'privacy',
      'tags',
      'title',
    ]);
    expect(item.lastError?.message).toBe('boom');
  });

  it('rejects an item with an unknown status', () => {
    expect(() => parsePublishQueueItem({ ...RAW_ITEM, status: 'done' })).toThrow(RenderApiError);
  });

  it('parses the queue document', () => {
    const queue = parsePublishQueue({
      settings: { paused: true, dailyLimit: 5 },
      publishedLast24h: 2,
      nextAttemptAt: null,
      items: [RAW_ITEM],
    });

    expect(Object.keys(queue).sort()).toEqual(['items', 'nextAttemptAt', 'publishedLast24h', 'settings']);
    expect(Object.keys(queue.settings).sort()).toEqual(['dailyLimit', 'paused']);
    expect(queue.items).toHaveLength(1);
  });

  it('rejects a queue without settings', () => {
    expect(() => parsePublishQueue({ publishedLast24h: 0, nextAttemptAt: null, items: [] })).toThrow(RenderApiError);
  });

  it('parses the add result with and without the already published notice', () => {
    const duplicated = parsePublishQueueAddResult({ item: RAW_ITEM, alreadyPublished: { url: 'https://y.be/1' } });
    const fresh = parsePublishQueueAddResult({ item: RAW_ITEM, alreadyPublished: null });

    expect(Object.keys(duplicated).sort()).toEqual(['alreadyPublished', 'item']);
    expect(duplicated.alreadyPublished).toEqual({ url: 'https://y.be/1' });
    expect(fresh.alreadyPublished).toBeNull();
  });

  it('parses the category playlists mapping and rejects non string entries', () => {
    const mapping = parseCategoryPlaylists({ categoryPlaylists: { c1: 'PL1', c2: null }, generalPlaylistId: null });

    expect(Object.keys(mapping).sort()).toEqual(['categoryPlaylists', 'generalPlaylistId']);
    expect(mapping.categoryPlaylists).toEqual({ c1: 'PL1', c2: null });
    expect(() => parseCategoryPlaylists({ categoryPlaylists: { c1: 3 }, generalPlaylistId: null })).toThrow(
      RenderApiError,
    );
  });

  it('parses the channel playlists', () => {
    const playlists = parseYouTubePlaylistListing({ playlists: [{ id: 'PL1', title: 'A', itemCount: 4 }] });

    expect(Object.keys(playlists[0] ?? {}).sort()).toEqual(['id', 'title']);
  });
});
