import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { buildNasaSearchUrl, NASA_LICENSE, searchNasaMedia } from './nasa-media-search';

function searchItem(overrides: Partial<{
  nasaId: string;
  title: string;
  href: string;
  photographer: string;
  secondaryCreator: string;
}>) {
  return {
    href: overrides.href ?? `http://images-assets.nasa.gov/image/${overrides.nasaId ?? 'PIA00001'}/collection.json`,
    data: [
      {
        nasa_id: overrides.nasaId ?? 'PIA00001',
        title: overrides.title ?? 'Nebula',
        media_type: 'image',
        ...(overrides.photographer === undefined ? {} : { photographer: overrides.photographer }),
        ...(overrides.secondaryCreator === undefined ? {} : { secondary_creator: overrides.secondaryCreator }),
      },
    ],
  };
}

function searchPayload(items: readonly unknown[]) {
  return { collection: { items } };
}

function collectionPayload(hrefs: readonly string[]) {
  return hrefs;
}

describe('buildNasaSearchUrl', () => {
  it('targets the NASA search endpoint with q and media_type', () => {
    const url = new URL(buildNasaSearchUrl('nebula', 'image'));
    expect(url.origin + url.pathname).toBe('https://images-api.nasa.gov/search');
    expect(url.searchParams.get('q')).toBe('nebula');
    expect(url.searchParams.get('media_type')).toBe('image');
  });
});

describe('searchNasaMedia (image)', () => {
  it('keeps an item with no photographer or secondary_creator and picks the ~large.jpg asset', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({})])) };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(
          collectionPayload([
            'http://images-assets.nasa.gov/image/PIA00001/PIA00001~thumb.jpg',
            'http://images-assets.nasa.gov/image/PIA00001/PIA00001~large.jpg',
            'http://images-assets.nasa.gov/image/PIA00001/PIA00001~orig.jpg',
          ]),
        ),
      };
    });

    const results = await searchNasaMedia(fetchRemote, 'nebula', 'image', 5);

    expect(results).toEqual([
      {
        resultId: expect.any(String),
        source: 'nasa',
        kind: 'image',
        title: 'Nebula',
        license: NASA_LICENSE,
        author: 'NASA',
        pageUrl: 'https://images.nasa.gov/details/PIA00001',
        downloadUrl: 'https://images-assets.nasa.gov/image/PIA00001/PIA00001~large.jpg',
        durationMs: null,
        width: null,
        height: null,
      },
    ]);
  });

  it('keeps an item whose photographer credit contains NASA', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return {
          status: 200,
          bodyChunks: jsonBodyChunks(searchPayload([searchItem({ photographer: 'NASA/JPL-Caltech' })])),
        };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(collectionPayload(['http://images-assets.nasa.gov/image/PIA00001/PIA00001~large.jpg'])),
      };
    });

    const results = await searchNasaMedia(fetchRemote, 'nebula', 'image', 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.author).toBe('NASA/JPL-Caltech');
  });

  it('drops an item whose photographer credit does not mention NASA', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(searchPayload([searchItem({ photographer: 'Rocket Lab' })])),
    });

    expect(await searchNasaMedia(fetchRemote, 'nebula', 'image', 5)).toEqual([]);
  });

  it('falls back to ~orig with an allowed extension when there is no ~large.jpg', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({})])) };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(
          collectionPayload(['http://images-assets.nasa.gov/image/PIA00001/PIA00001~orig.png']),
        ),
      };
    });

    const results = await searchNasaMedia(fetchRemote, 'nebula', 'image', 5);

    expect(results[0]?.downloadUrl).toBe('https://images-assets.nasa.gov/image/PIA00001/PIA00001~orig.png');
  });

  it('drops an item whose collection manifest has neither ~large nor a usable ~orig', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({})])) };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(collectionPayload(['http://images-assets.nasa.gov/image/PIA00001/PIA00001~orig.tif'])),
      };
    });

    expect(await searchNasaMedia(fetchRemote, 'nebula', 'image', 5)).toEqual([]);
  });
});

describe('searchNasaMedia (video)', () => {
  it('picks the ~medium.mp4 asset and drops when it is missing', async () => {
    const { fetchRemote: fetchWithMedium } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({ nasaId: 'PIA00002', title: 'Launch' })])) };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(
          collectionPayload([
            'http://images-assets.nasa.gov/video/PIA00002/PIA00002~orig.mp4',
            'http://images-assets.nasa.gov/video/PIA00002/PIA00002~medium.mp4',
          ]),
        ),
      };
    });

    const results = await searchNasaMedia(fetchWithMedium, 'launch', 'video', 5);
    expect(results[0]?.downloadUrl).toBe('https://images-assets.nasa.gov/video/PIA00002/PIA00002~medium.mp4');

    const { fetchRemote: fetchWithoutMedium } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({ nasaId: 'PIA00002', title: 'Launch' })])) };
      }
      return {
        status: 200,
        bodyChunks: jsonBodyChunks(collectionPayload(['http://images-assets.nasa.gov/video/PIA00002/PIA00002~orig.mp4'])),
      };
    });

    expect(await searchNasaMedia(fetchWithoutMedium, 'launch', 'video', 5)).toEqual([]);
  });
});

describe('searchNasaMedia error handling', () => {
  it('throws when the search endpoint answers a non-200 status', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 503, bodyChunks: textBodyChunks('down') });
    await expect(searchNasaMedia(fetchRemote, 'nebula', 'image', 5)).rejects.toThrow();
  });

  it('throws when the search body is not valid JSON', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: textBodyChunks('not json') });
    await expect(searchNasaMedia(fetchRemote, 'nebula', 'image', 5)).rejects.toThrow();
  });

  it('skips a candidate whose collection manifest fetch fails, without failing the whole search', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks(searchPayload([searchItem({})])) };
      }
      return { status: 500, bodyChunks: textBodyChunks('down') };
    });

    expect(await searchNasaMedia(fetchRemote, 'nebula', 'image', 5)).toEqual([]);
  });
});
