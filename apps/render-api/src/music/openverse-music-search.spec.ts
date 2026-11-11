import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { buildOpenverseSearchUrl, openverseQueries, parseOpenverseSearchPayload, searchOpenverseMusic } from './openverse-music-search';

function audio(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    title: 'Upbeat Corporate',
    creator: 'Soundrider/Dope',
    license: 'by',
    license_version: '3.0',
    duration: 100_000,
    url: 'https://prod-1.storage.jamendo.com/?trackid=1670486&format=mp32',
    foreign_landing_url: 'https://www.jamendo.com/track/1670486',
    filetype: 'mp32',
    ...overrides,
  };
}

describe('parseOpenverseSearchPayload', () => {
  it('turns a Jamendo track into a free music result with its credit and a portable file name', () => {
    const [result] = parseOpenverseSearchPayload({ results: [audio()] });
    expect(result).toMatchObject({
      title: 'Upbeat Corporate',
      author: 'Soundrider/Dope',
      license: 'CC BY 3.0',
      durationMs: 100_000,
      pageUrl: 'https://www.jamendo.com/track/1670486',
      source: 'openverse',
      fileName: 'Upbeat Corporate.mp3',
    });
  });

  it('keeps CC0 and public domain, and drops share-alike and no-derivatives licenses, wrong lengths and unknown hosts', () => {
    const results = parseOpenverseSearchPayload({
      results: [
        audio({ id: 'cc0', license: 'cc0', license_version: '1.0' }),
        audio({ id: 'pdm', license: 'pdm', license_version: '1.0' }),
        audio({ id: 'nd', license: 'by-nd' }),
        audio({ id: 'sa', license: 'by-sa' }),
        audio({ id: 'short', duration: 12_000 }),
        audio({ id: 'long', duration: 5_950_000 }),
        audio({ id: 'host', url: 'https://cdn.example.com/track.mp3' }),
      ],
    });
    expect(results.map((result) => result.license)).toEqual(['CC0 1.0', 'Public Domain Mark']);
  });

  it('throws on an unexpected payload so the next source can fill in', () => {
    expect(() => parseOpenverseSearchPayload({ query: {} })).toThrow('unexpected payload');
  });
});

describe('searchOpenverseMusic', () => {
  it('asks for commercial-safe music only', () => {
    const url = new URL(buildOpenverseSearchUrl('calm', 12));
    expect(url.searchParams.get('license')).toBe('by,cc0,pdm');
    expect(url.searchParams.get('category')).toBe('music');
    expect(url.searchParams.get('page_size')).toBe('12');
  });

  it('falls back to single words when the whole mood finds nothing, within three requests', async () => {
    expect(openverseQueries('calm lo-fi tutorial music')).toEqual(['calm lo-fi tutorial music', 'calm', 'lo-fi']);
    const { fetchRemote, calls } = createFakeFetchRemote((_call, index) =>
      index === 0 ? { status: 200, bodyChunks: jsonBodyChunks({ results: [] }) } : { status: 200, bodyChunks: jsonBodyChunks({ results: [audio()] }) },
    );

    const results = await searchOpenverseMusic(fetchRemote, 'calm tutorial', 1);

    expect(results).toHaveLength(1);
    expect(calls.map((call) => new URL(call.url).searchParams.get('q'))).toEqual(['calm tutorial', 'calm']);
  });
});
