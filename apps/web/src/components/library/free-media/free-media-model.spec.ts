import { describe, expect, it, vi } from 'vitest';

import { formatDimensions, formatDuration, importFreeResult, searchFreeResults, tabsForMode } from './free-media-model';
import type { FreeResult } from './free-media-model';
import type { RenderApiClientFacade } from './free-media-types';

function facade(): RenderApiClientFacade {
  return {
    searchFreeMedia: vi.fn().mockResolvedValue([
      { resultId: 'a', source: 'nasa', kind: 'video', title: 'Launch', license: 'Public domain', author: 'NASA', pageUrl: 'https://x', durationMs: 12000, width: 1920, height: 1080 },
    ]),
    importFreeMedia: vi.fn().mockResolvedValue({ path: 'raw/broll/a.mp4', credit: {} }),
    searchFreeMusic: vi.fn().mockResolvedValue([
      { resultId: 'm', source: 'openverse', title: 'Calm', license: 'CC BY', author: 'Ana', pageUrl: 'https://y', durationMs: 90000 },
    ]),
    importFreeMusic: vi.fn().mockResolvedValue({ path: 'raw/audio/m.mp3', credit: {} }),
  } as unknown as RenderApiClientFacade;
}

describe('free media model', () => {
  it('searches media with the tab as kind', async () => {
    const client = facade();

    const results = await searchFreeResults(client, 'demo', 'video', 'launch', 10);

    expect(client.searchFreeMedia).toHaveBeenCalledWith({ slug: 'demo', query: 'launch', kind: 'video', maxResults: 10 });
    expect(results[0]?.tab).toBe('video');
  });

  it('searches music by mood', async () => {
    const client = facade();

    const results = await searchFreeResults(client, 'demo', 'music', 'calm', 5);

    expect(client.searchFreeMusic).toHaveBeenCalledWith({ slug: 'demo', mood: 'calm', maxResults: 5 });
    expect(results[0]?.tab).toBe('music');
  });

  it('imports through the endpoint that matches the result', async () => {
    const client = facade();
    const media = { tab: 'image', resultId: 'a' } as FreeResult;
    const music = { tab: 'music', resultId: 'm' } as FreeResult;

    await importFreeResult(client, 'demo', media);
    await importFreeResult(client, 'demo', music);

    expect(client.importFreeMedia).toHaveBeenCalledWith('demo', 'a');
    expect(client.importFreeMusic).toHaveBeenCalledWith('demo', 'm');
  });

  it('formats durations and dimensions', () => {
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(null)).toBeNull();
    expect(formatDimensions(1920, 1080)).toBe('1920×1080');
    expect(formatDimensions(null, 10)).toBeNull();
  });

  it('limits motion projects to images', () => {
    expect(tabsForMode(true)).toEqual(['image']);
    expect(tabsForMode(false)).toEqual(['image', 'video', 'music']);
  });
});
