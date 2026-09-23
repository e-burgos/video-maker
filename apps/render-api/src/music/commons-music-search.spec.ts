import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks, textBodyChunks } from '../__fixtures__/fake-fetch-remote';
import {
  buildCommonsSearchUrl,
  COMMONS_API_URL,
  isFreeCommercialLicense,
  parseCommonsSearchPayload,
  searchCommonsMusic,
  stripHtml,
} from './commons-music-search';

function commonsPage(overrides: Partial<{
  title: string;
  url: string;
  descriptionurl: string;
  mime: string;
  duration: number;
  license: string;
  artist: string;
}>) {
  return {
    title: overrides.title ?? 'File:Calm Piano.mp3',
    imageinfo: [
      {
        url: overrides.url ?? 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Calm_Piano.mp3',
        descriptionurl: overrides.descriptionurl ?? 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
        mime: overrides.mime ?? 'audio/mpeg',
        duration: overrides.duration ?? 120.5,
        extmetadata: {
          LicenseShortName: { value: overrides.license ?? 'CC BY 3.0' },
          Artist: { value: overrides.artist ?? '<a href="https://example.com">Jane Doe</a>' },
        },
      },
    ],
  };
}

describe('stripHtml', () => {
  it('removes nested tags and keeps the text content', () => {
    expect(stripHtml('<bdi><a href="x"><span title="y">Kevin MacLeod</span></a></bdi>')).toBe('Kevin MacLeod');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('Rock &amp; Roll')).toBe('Rock & Roll');
  });

  it('collapses whitespace and trims', () => {
    expect(stripHtml('  <p>hello</p>\n<p>world</p>  ')).toBe('hello world');
  });
});

describe('isFreeCommercialLicense', () => {
  it.each(['CC0 1.0', 'CC0', 'Public domain', 'PDM-owner', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 4.0'])(
    'accepts %s',
    (license) => {
      expect(isFreeCommercialLicense(license)).toBe(true);
    },
  );

  it.each(['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 4.0', 'CC BY-NC-ND 4.0', 'All rights reserved', ''])(
    'rejects %s',
    (license) => {
      expect(isFreeCommercialLicense(license)).toBe(false);
    },
  );

  it('rejects an undefined license', () => {
    expect(isFreeCommercialLicense(undefined)).toBe(false);
  });
});

describe('buildCommonsSearchUrl', () => {
  it('targets the commons API with the audio filetype filter and formatversion 2', () => {
    const url = new URL(buildCommonsSearchUrl('calm piano', 12));
    expect(url.origin + url.pathname).toBe(COMMONS_API_URL);
    expect(url.searchParams.get('generator')).toBe('search');
    expect(url.searchParams.get('gsrnamespace')).toBe('6');
    expect(url.searchParams.get('gsrsearch')).toBe('calm piano filetype:audio');
    expect(url.searchParams.get('gsrlimit')).toBe('12');
    expect(url.searchParams.get('prop')).toBe('imageinfo');
    expect(url.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('formatversion')).toBe('2');
  });
});

describe('parseCommonsSearchPayload', () => {
  it('keeps a result with an allowed mime, a free commercial license and a duration', () => {
    const results = parseCommonsSearchPayload({ query: { pages: [commonsPage({})] } });
    expect(results).toEqual([
      {
        resultId: expect.any(String),
        title: 'Calm Piano.mp3',
        durationMs: 120500,
        license: 'CC BY 3.0',
        author: 'Jane Doe',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
        downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Calm_Piano.mp3',
      },
    ]);
  });

  it('drops a result with a non-commercial license', () => {
    const results = parseCommonsSearchPayload({ query: { pages: [commonsPage({ license: 'CC BY-NC 4.0' })] } });
    expect(results).toEqual([]);
  });

  it('drops a result with an unknown (missing) license', () => {
    const page = commonsPage({});
    delete (page.imageinfo[0].extmetadata as Record<string, unknown>).LicenseShortName;
    expect(parseCommonsSearchPayload({ query: { pages: [page] } })).toEqual([]);
  });

  it('drops a result with a disallowed mime (e.g. midi)', () => {
    const results = parseCommonsSearchPayload({ query: { pages: [commonsPage({ mime: 'audio/midi' })] } });
    expect(results).toEqual([]);
  });

  it('drops a result with application/ogg mime as allowed (opus/ogg containers)', () => {
    const results = parseCommonsSearchPayload({ query: { pages: [commonsPage({ mime: 'application/ogg' })] } });
    expect(results).toHaveLength(1);
  });

  it('drops a result with no duration', () => {
    const page = commonsPage({});
    delete (page.imageinfo[0] as Record<string, unknown>).duration;
    expect(parseCommonsSearchPayload({ query: { pages: [page] } })).toEqual([]);
  });

  it('is stable: the same file title always maps to the same resultId', () => {
    const [first] = parseCommonsSearchPayload({ query: { pages: [commonsPage({})] } });
    const [second] = parseCommonsSearchPayload({ query: { pages: [commonsPage({})] } });
    expect(first?.resultId).toBe(second?.resultId);
  });

  it('returns an empty array for a zero-hit response (no query.pages)', () => {
    expect(parseCommonsSearchPayload({ batchcomplete: true })).toEqual([]);
  });

  it('throws on an error payload', () => {
    expect(() => parseCommonsSearchPayload({ error: { code: 'x', info: 'y' } })).toThrow();
  });

  it('throws on a non-object payload', () => {
    expect(() => parseCommonsSearchPayload('not an object')).toThrow();
  });
});

describe('searchCommonsMusic', () => {
  it('sends the descriptive User-Agent and returns filtered, capped results', async () => {
    const { fetchRemote, calls } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({
        query: {
          pages: [commonsPage({ title: 'File:One.mp3' }), commonsPage({ title: 'File:Two.mp3' })],
        },
      }),
    });

    const results = await searchCommonsMusic(fetchRemote, 'calm piano', 1);

    expect(results).toHaveLength(1);
    expect(calls[0]?.init.headers?.['user-agent']).toContain('video-maker-studio');
  });

  it('throws when Commons answers a non-200 status', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 503, bodyChunks: textBodyChunks('down') });
    await expect(searchCommonsMusic(fetchRemote, 'calm piano', 5)).rejects.toThrow();
  });

  it('throws when the body is not valid JSON', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: textBodyChunks('not json') });
    await expect(searchCommonsMusic(fetchRemote, 'calm piano', 5)).rejects.toThrow();
  });

  it('throws when fetchRemote itself rejects (network failure)', async () => {
    const { fetchRemote } = createFakeFetchRemote(new Error('network down'));
    await expect(searchCommonsMusic(fetchRemote, 'calm piano', 5)).rejects.toThrow();
  });
});
