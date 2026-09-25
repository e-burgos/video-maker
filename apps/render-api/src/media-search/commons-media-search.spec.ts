import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { buildCommonsMediaSearchUrl, searchCommonsMedia } from './commons-media-search';
import { COMMONS_API_URL } from '../music/commons-music-search';

function commonsPage(overrides: Partial<{
  title: string;
  url: string;
  descriptionurl: string;
  mime: string;
  duration: number;
  width: number;
  height: number;
  license: string;
  artist: string;
}>) {
  return {
    title: overrides.title ?? 'File:Ocean Waves.mp4',
    imageinfo: [
      {
        url: overrides.url ?? 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.mp4',
        descriptionurl: overrides.descriptionurl ?? 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.mp4',
        mime: overrides.mime ?? 'video/mp4',
        duration: overrides.duration ?? 12.5,
        width: overrides.width,
        height: overrides.height,
        extmetadata: {
          LicenseShortName: { value: overrides.license ?? 'CC BY 3.0' },
          Artist: { value: overrides.artist ?? 'Jane Doe' },
        },
      },
    ],
  };
}

function derivativesPayload(src: string | null) {
  return {
    query: {
      pages: [{ videoinfo: [{ derivatives: src === null ? [] : [{ src }] }] }],
    },
  };
}

describe('buildCommonsMediaSearchUrl', () => {
  it('targets filetype:video for kind video', () => {
    const url = new URL(buildCommonsMediaSearchUrl('ocean', 'video', 12));
    expect(url.origin + url.pathname).toBe(COMMONS_API_URL);
    expect(url.searchParams.get('gsrsearch')).toBe('ocean filetype:video');
    expect(url.searchParams.get('gsrlimit')).toBe('12');
  });

  it('targets filetype:bitmap for kind image', () => {
    const url = new URL(buildCommonsMediaSearchUrl('ocean', 'image', 8));
    expect(url.searchParams.get('gsrsearch')).toBe('ocean filetype:bitmap');
  });
});

describe('searchCommonsMedia (video)', () => {
  it('accepts an mp4 result and reports its durationMs', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({})] } }),
    });

    const results = await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5);

    expect(results).toEqual([
      {
        resultId: expect.any(String),
        source: 'commons',
        kind: 'video',
        title: 'Ocean Waves.mp4',
        license: 'CC BY 3.0',
        author: 'Jane Doe',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Ocean_Waves.mp4',
        downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.mp4',
        durationMs: 12500,
        width: null,
        height: null,
      },
    ]);
  });

  it('accepts a webm result directly', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({
        query: { pages: [commonsPage({ mime: 'video/webm', url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.webm' })] },
      }),
    });

    const results = await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.downloadUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/a/aa/Ocean_Waves.webm');
  });

  it('takes an ogv result by its transcoded webm derivative when one exists', async () => {
    const derivativeUrl = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/aa/Ocean_Waves.ogv/Ocean_Waves.ogv.480p.vp9.webm';
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({ mime: 'video/ogg' })] } }) };
      }
      return { status: 200, bodyChunks: jsonBodyChunks(derivativesPayload(derivativeUrl)) };
    });

    const results = await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5);

    expect(results).toHaveLength(1);
    expect(results[0]?.downloadUrl).toBe(derivativeUrl);
  });

  it('drops an ogv result with no webm derivative available', async () => {
    const { fetchRemote } = createFakeFetchRemote((_call, index) => {
      if (index === 0) {
        return { status: 200, bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({ mime: 'video/ogg' })] } }) };
      }
      return { status: 200, bodyChunks: jsonBodyChunks(derivativesPayload(null)) };
    });

    const results = await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5);

    expect(results).toEqual([]);
  });

  it('drops a result with a non-commercial license', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({ license: 'CC BY-NC 4.0' })] } }),
    });

    expect(await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5)).toEqual([]);
  });

  it('drops a result with a disallowed mime (e.g. matroska)', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({ mime: 'video/x-matroska' })] } }),
    });

    expect(await searchCommonsMedia(fetchRemote, 'ocean', 'video', 5)).toEqual([]);
  });

  it('throws when Commons answers a non-200 status', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 503, bodyChunks: textBodyChunks('down') });
    await expect(searchCommonsMedia(fetchRemote, 'ocean', 'video', 5)).rejects.toThrow();
  });

  it('throws when the body is not valid JSON', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: textBodyChunks('not json') });
    await expect(searchCommonsMedia(fetchRemote, 'ocean', 'video', 5)).rejects.toThrow();
  });
});

describe('searchCommonsMedia (image)', () => {
  it('accepts a jpeg result and reports width/height', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({
        query: {
          pages: [
            commonsPage({
              title: 'File:Nebula.jpg',
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Nebula.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Nebula.jpg',
              mime: 'image/jpeg',
              width: 1920,
              height: 1080,
            }),
          ],
        },
      }),
    });

    const results = await searchCommonsMedia(fetchRemote, 'nebula', 'image', 5);

    expect(results).toEqual([
      {
        resultId: expect.any(String),
        source: 'commons',
        kind: 'image',
        title: 'Nebula.jpg',
        license: 'CC BY 3.0',
        author: 'Jane Doe',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Nebula.jpg',
        downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Nebula.jpg',
        durationMs: null,
        width: 1920,
        height: 1080,
      },
    ]);
  });

  it('drops a result with a disallowed mime (e.g. tiff)', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({ query: { pages: [commonsPage({ mime: 'image/tiff' })] } }),
    });

    expect(await searchCommonsMedia(fetchRemote, 'nebula', 'image', 5)).toEqual([]);
  });
});
