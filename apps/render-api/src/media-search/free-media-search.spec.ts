import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { searchFreeMedia } from './free-media-search';

function commonsSearchPayload() {
  return {
    query: {
      pages: [
        {
          title: 'File:Ocean Waves.mp4',
          imageinfo: [
            {
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.mp4',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.mp4',
              mime: 'video/mp4',
              duration: 10,
              extmetadata: { LicenseShortName: { value: 'CC0' }, Artist: { value: 'Jane' } },
            },
          ],
        },
      ],
    },
  };
}

function nasaSearchPayload() {
  return {
    collection: {
      items: [
        {
          href: 'http://images-assets.nasa.gov/video/PIA1/collection.json',
          data: [{ nasa_id: 'PIA1', title: 'Launch', media_type: 'video' }],
        },
      ],
    },
  };
}

function nasaCollectionPayload() {
  return ['http://images-assets.nasa.gov/video/PIA1/PIA1~medium.mp4'];
}

function combinedFetch(overrides?: { readonly commonsStatus?: number; readonly nasaStatus?: number }) {
  const { fetchRemote } = createFakeFetchRemote((call) => {
    if (call.url.includes('commons.wikimedia.org')) {
      return { status: overrides?.commonsStatus ?? 200, bodyChunks: jsonBodyChunks(commonsSearchPayload()) };
    }
    if (call.url.includes('images-api.nasa.gov')) {
      return { status: overrides?.nasaStatus ?? 200, bodyChunks: jsonBodyChunks(nasaSearchPayload()) };
    }
    return { status: 200, bodyChunks: jsonBodyChunks(nasaCollectionPayload()) };
  });
  return fetchRemote;
}

describe('searchFreeMedia', () => {
  it('merges results from both sources', async () => {
    const results = await searchFreeMedia(combinedFetch(), 'ocean', 'video', 5);

    expect(results.map((result) => result.source).sort()).toEqual(['commons', 'nasa']);
  });

  it('tolerates one source failing and returns the other', async () => {
    const results = await searchFreeMedia(combinedFetch({ commonsStatus: 500 }), 'ocean', 'video', 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.source).toBe('nasa');
  });

  it('throws when both sources fail', async () => {
    await expect(
      searchFreeMedia(combinedFetch({ commonsStatus: 500, nasaStatus: 500 }), 'ocean', 'video', 5),
    ).rejects.toThrow();
  });

  it('caps the merged results to maxResults', async () => {
    const results = await searchFreeMedia(combinedFetch(), 'ocean', 'video', 1);

    expect(results).toHaveLength(1);
  });

  it('interleaves sources instead of letting Commons alone fill the cap and starve NASA', async () => {
    const results = await searchFreeMedia(combinedFetch(), 'ocean', 'video', 2);

    expect(results.map((result) => result.source)).toEqual(['commons', 'nasa']);
  });
});
