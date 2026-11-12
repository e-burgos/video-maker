import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import { describe, expect, it } from 'vitest';
import type { ZodArray, ZodObject } from 'zod';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks, textBodyChunks } from '../../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleImportBrandMusic, handleImportMusic, handleSearchFreeMusic } from './music-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const SEARCH_OUTPUT_SHAPE = (STUDIO_TOOLS.search_free_music.output as ZodObject).shape;
const SEARCH_OUTPUT_KEYS = Object.keys(SEARCH_OUTPUT_SHAPE).sort();
const SEARCH_RESULT_ITEM_KEYS = Object.keys(((SEARCH_OUTPUT_SHAPE.results as ZodArray).element as ZodObject).shape).sort();
const IMPORT_OUTPUT_KEYS = Object.keys((STUDIO_TOOLS.import_music.output as ZodObject).shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function searchRequest(slug: string, query: string): ReturnType<typeof requestLine> {
  return requestLine({ method: 'GET', path: `/projects/${slug}/music/search?${query}` });
}

function searchAnswer(url: string): { status: number; bodyChunks: readonly Uint8Array[] } | null {
  if (url.startsWith('https://api.openverse.org/')) {
    return { status: 200, bodyChunks: jsonBodyChunks({ results: [] }) };
  }
  return url.startsWith('https://commons.wikimedia.org/') ? { status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) } : null;
}

function importRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/music/import`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

const COMMONS_SEARCH_PAYLOAD = {
  query: {
    pages: [
      {
        title: 'File:Calm Piano.mp3',
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Calm_Piano.mp3',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Calm_Piano.mp3',
            mime: 'audio/mpeg',
            duration: 120.5,
            extmetadata: {
              LicenseShortName: { value: 'CC BY 3.0' },
              Artist: { value: 'Jane Doe' },
            },
          },
        ],
      },
    ],
  },
};

describe('handleSearchFreeMusic', () => {
  it('answers 200 with exactly the search_free_music output keys, without leaking downloadUrl', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleSearchFreeMusic(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'mood=calm+piano&maxResults=5'),
      runtime,
    );

    expect(response.status).toBe(200);
    const body = response.body as { results: readonly Record<string, unknown>[] };
    expect(Object.keys(body).sort()).toEqual(SEARCH_OUTPUT_KEYS);
    expect(body.results).toHaveLength(1);
    expect(Object.keys(body.results[0] ?? {}).sort()).toEqual(SEARCH_RESULT_ITEM_KEYS);
    expect(body.results[0]).not.toHaveProperty('downloadUrl');
    expect(body.results[0]).toMatchObject({ title: 'Calm Piano.mp3', license: 'CC BY 3.0', author: 'Jane Doe' });
  });

  it('rejects a missing mood with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'maxResults=5'), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects maxResults outside 1..10 with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=11'), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('answers 503 MUSIC_SOURCE_UNAVAILABLE when Commons fails', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 500, bodyChunks: textBodyChunks('down') });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=5'), runtime),
    ).rejects.toMatchObject({ code: 'MUSIC_SOURCE_UNAVAILABLE' });
  });
});

describe('handleImportMusic', () => {
  it('answers 404 MUSIC_RESULT_UNKNOWN for a resultId with no prior search', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId: 'nope' }), runtime),
    ).rejects.toMatchObject({ code: 'MUSIC_RESULT_UNKNOWN' });
  });

  it('rejects a missing resultId with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', {}), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('downloads a previously searched result, writes the credit and answers exactly the import_music output keys', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const audioBytes = textBodyChunks('audio-bytes');
    const { fetchRemote } = createFakeFetchRemote(({ url }) => {
      const search = searchAnswer(url);
      if (search !== null) {
        return search;
      }
      return {
        status: 200,
        headers: { 'content-length': String(audioBytes[0]?.byteLength ?? 0) },
        bodyChunks: audioBytes,
      };
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const searchResponse = await handleSearchFreeMusic(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'mood=calm&maxResults=5'),
      runtime,
    );
    const resultId = (searchResponse.body as { results: readonly { resultId: string }[] }).results[0]?.resultId;
    expect(resultId).toBeDefined();

    const response = await handleImportMusic(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      importRequest('pitch-deck', { resultId }),
      runtime,
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(IMPORT_OUTPUT_KEYS);
    expect(body.path).toBe('raw/audio/Calm_Piano.mp3');
    expect(body.credit).toMatchObject({ kind: 'music', title: 'Calm Piano.mp3', author: 'Jane Doe', license: 'CC BY 3.0' });

    const creditsRaw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(creditsRaw)).toEqual([body.credit]);
  });

  it('answers 503 MUSIC_SOURCE_UNAVAILABLE when the download fails', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote(({ url }) => searchAnswer(url) ?? { status: 500, bodyChunks: textBodyChunks('down') });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const searchResponse = await handleSearchFreeMusic(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'mood=calm&maxResults=5'),
      runtime,
    );
    const resultId = (searchResponse.body as { results: readonly { resultId: string }[] }).results[0]?.resultId;

    await expect(
      handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId }), runtime),
    ).rejects.toMatchObject({ code: 'MUSIC_SOURCE_UNAVAILABLE' });
  });
});

const BANK_BRAND_DIR = `${STORE.motionAssetsRoot}/brands/acme`;
const BANK_BRAND = {
  id: 'acme',
  name: 'Acme',
  spokenName: 'Acme',
  tagline: 'Hecho fácil.',
  logo: 'img/logo.svg',
  palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
  fonts: [{ family: 'Inter', file: 'fonts/inter.woff2' }],
  devices: {},
  images: {},
  music: [
    { id: 'calma', file: 'music/Calma.mp3', credit: '"Calma" Kevin MacLeod (incompetech.com) · CC BY 4.0', bpm: 90, mood: 'calm lo-fi', videoTypes: ['tutorial'] },
    { id: 'serena', file: 'music/Serena.mp3', credit: '"Serena" Kevin MacLeod (incompetech.com) · CC BY 4.0', bpm: 80, mood: 'calm ambient', videoTypes: ['tutorial'] },
    { id: 'pulso', file: 'music/Pulso.mp3', credit: '"Pulso" Kevin MacLeod (incompetech.com) · CC BY 4.0', bpm: 128, mood: 'energetic', videoTypes: ['vertical'] },
  ],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const CHILD_BRAND = { ...BANK_BRAND, id: 'acme-tutoriales', name: 'Acme Tutoriales', music: [], musicFrom: 'acme' };
const LOCAL_TRACK = { id: 'pulsar', file: 'Pulsar.mp3', credit: '"Pulsar" The Grey Room · Biblioteca de audio de YouTube', bpm: 104, mood: 'calm ambient', videoTypes: ['tutorial'] };

function bankSetup(commons: Parameters<typeof createFakeFetchRemote>[0], usage: Record<string, string> = {}, projectBrand = 'acme') {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: [
      { path: `${BANK_BRAND_DIR}/brand.json`, contents: JSON.stringify(BANK_BRAND) },
      { path: `${BANK_BRAND_DIR}/music/Calma.mp3`, contents: 'calma' },
      { path: `${BANK_BRAND_DIR}/music/Serena.mp3`, contents: 'serena' },
      { path: '/brands/.local-music/acme/music.json', contents: JSON.stringify([LOCAL_TRACK]) },
      { path: '/brands/.local-music/acme/Pulsar.mp3', contents: 'pulsar' },
      { path: '/brands/acme-tutoriales/brand.json', contents: JSON.stringify(CHILD_BRAND) },
      { path: '/media/.music-usage.json', contents: JSON.stringify(usage) },
    ],
  });
  const { fetchRemote } = createFakeFetchRemote(commons);
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    fetchRemote,
    listMotionBrands: async () => [
      { id: 'acme', source: 'built-in', manifest: BANK_BRAND },
      { id: 'acme-tutoriales', source: 'user', manifest: CHILD_BRAND },
    ],
  });
  deps.localStore.projects.insert('pitch-deck', null, 'footage', projectBrand);
  return { deps, storage, runtime: createRenderApiRuntime(deps) };
}

describe('the brand music bank in search_free_music and import_music', () => {
  it('answers the matching bank tracks first, least recently used first, and fills the rest from Commons', async () => {
    const { deps, runtime } = bankSetup(
      { status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) },
      { 'acme/calma': '2026-11-09T10:00:00.000Z', 'acme/pulsar': '2026-11-10T10:00:00.000Z' },
    );

    const response = await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm+tutorial&maxResults=4'), runtime);

    const results = (response.body as { results: readonly Record<string, unknown>[] }).results;
    expect(results.map((result) => [result.resultId, result.source])).toEqual([
      ['bank-serena', 'brand-bank'],
      ['bank-calma', 'brand-bank'],
      ['bank-pulsar', 'brand-bank'],
      [expect.any(String), 'commons'],
    ]);
    expect(results[0]).toMatchObject({ author: 'Kevin MacLeod (incompetech.com)', license: 'CC BY 4.0', durationMs: 12000 });
    expect(results[0]?.title).toBe('Serena (calm ambient; for tutorial videos)');
  });

  it('keeps the bank results when Commons does not answer', async () => {
    const { deps, runtime } = bankSetup(new Error('offline'));

    const response = await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=5'), runtime);

    expect((response.body as { results: readonly unknown[] }).results).toHaveLength(3);
  });

  it('copies a local bank track into raw/audio, records its credit and logs the use for the rotation', async () => {
    const { deps, storage, runtime } = bankSetup(new Error('offline'));
    await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=ambient&maxResults=5'), runtime);

    const response = await handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId: 'bank-pulsar' }), runtime);

    expect(response.body).toMatchObject({ path: 'raw/audio/Pulsar.mp3', credit: { title: 'Pulsar', author: 'The Grey Room', license: 'Biblioteca de audio de YouTube' } });
    expect(await storage.readTextFile(`${PROJECT_ROOT}/raw/audio/Pulsar.mp3`)).toBe('pulsar');
    expect(JSON.parse(await storage.readTextFile('/media/.music-usage.json'))).toEqual({ 'acme/pulsar': '2026-09-08T00:00:00.000Z' });
  });

  it('lets a brand that takes its music from another one search and import that bank', async () => {
    const { deps, storage, runtime } = bankSetup(new Error('offline'), {}, 'acme-tutoriales');

    const search = await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=5'), runtime);
    const response = await handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId: 'bank-pulsar' }), runtime);

    expect((search.body as { results: readonly { resultId: string }[] }).results.map((result) => result.resultId)).toEqual(['bank-calma', 'bank-serena', 'bank-pulsar']);
    expect(response.body).toMatchObject({ path: 'raw/audio/Pulsar.mp3' });
    expect(await storage.readTextFile(`${PROJECT_ROOT}/raw/audio/Pulsar.mp3`)).toBe('pulsar');
    expect(JSON.parse(await storage.readTextFile('/media/.music-usage.json'))).toEqual({ 'acme-tutoriales/pulsar': '2026-09-08T00:00:00.000Z' });
  });

  it('fills after the bank with Openverse first, then Commons, and imports an Openverse track with its credit', async () => {
    const openverseTrack = {
      id: 'ov-1',
      title: 'Calm Morning',
      creator: 'Ana Ruiz',
      license: 'by',
      license_version: '3.0',
      duration: 150_000,
      url: 'https://prod-1.storage.jamendo.com/?trackid=1&format=mp32',
      foreign_landing_url: 'https://www.jamendo.com/track/1',
      filetype: 'mp32',
    };
    const { deps, storage, runtime } = bankSetup(({ url }) => {
      if (url.startsWith('https://api.openverse.org/')) {
        return { status: 200, bodyChunks: jsonBodyChunks({ results: [openverseTrack] }) };
      }
      if (url.startsWith('https://commons.wikimedia.org/')) {
        return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) };
      }
      return { status: 200, headers: { 'content-length': '7' }, bodyChunks: textBodyChunks('jamendo') };
    });

    const search = await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=5'), runtime);
    const results = (search.body as { results: readonly { resultId: string; source: string }[] }).results;
    const openverseId = results.find((result) => result.source === 'openverse')?.resultId;
    const response = await handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId: openverseId }), runtime);

    expect(results.map((result) => result.source)).toEqual(['brand-bank', 'brand-bank', 'brand-bank', 'openverse', 'commons']);
    expect(response.body).toMatchObject({ path: 'raw/audio/Calm Morning.mp3', credit: { title: 'Calm Morning', author: 'Ana Ruiz', license: 'CC BY 3.0', sourceUrl: 'https://www.jamendo.com/track/1' } });
    expect(await storage.readTextFile(`${PROJECT_ROOT}/raw/audio/Calm Morning.mp3`)).toBe('jamendo');
  });
});

describe('handleImportBrandMusic', () => {
  const BRAND_MANIFEST = {
    id: 'mine',
    name: 'Mine',
    spokenName: 'Mine',
    tagline: 'Hecho a mano.',
    logo: 'img/logo.svg',
    palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
    fonts: [{ family: 'Outfit', file: 'fonts/outfit.woff2' }],
    devices: {},
    images: {},
    music: [],
    voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
  };

  function audioFetch() {
    const audioBytes = textBodyChunks('audio-bytes');
    return createFakeFetchRemote(({ url }) => {
      const search = searchAnswer(url);
      if (search !== null) {
        return search;
      }
      return { status: 200, headers: { 'content-length': String(audioBytes[0]?.byteLength ?? 0) }, bodyChunks: audioBytes };
    }).fetchRemote;
  }

  function brandRequest(payload: unknown): ReturnType<typeof requestLine> {
    return requestLine({ method: 'POST', path: '/brands/mine/music/import', body: toChunks([JSON.stringify(payload)]) });
  }

  async function searchedSetup() {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT, '/brands/mine'],
      files: [
        { path: '/brands/mine/brand.json', contents: JSON.stringify(BRAND_MANIFEST) },
        { path: '/brands/mine/img/logo.svg', contents: '<svg/>' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote: audioFetch() });
    const runtime = createRenderApiRuntime(deps);
    const search = await handleSearchFreeMusic(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'mood=calm&maxResults=5'), runtime);
    const resultId = (search.body as { results: readonly { resultId: string }[] }).results[0]?.resultId;
    return { deps, storage, runtime, resultId };
  }

  it('stores the searched track in the brand music folder and appends it to the manifest with its credit', async () => {
    const { deps, storage, runtime, resultId } = await searchedSetup();

    const response = await handleImportBrandMusic(
      deps,
      STORE,
      { id: 'mine' },
      brandRequest({ slug: 'pitch-deck', resultId, bpm: 90, mood: 'calm piano', videoTypes: ['tutorial'] }),
      runtime,
    );

    expect(response.status).toBe(200);
    const manifest = JSON.parse(await storage.readTextFile('/brands/mine/brand.json')) as { music: readonly Record<string, unknown>[] };
    expect(manifest.music).toEqual([
      {
        id: 'calm-piano',
        file: 'music/Calm_Piano.mp3',
        credit: '"Calm Piano.mp3" Jane Doe \u00B7 CC BY 3.0',
        bpm: 90,
        mood: 'calm piano',
        videoTypes: ['tutorial'],
      },
    ]);
    expect((await storage.stat('/brands/mine/music/Calm_Piano.mp3'))?.kind).toBe('file');
  });

  it('rejects an unknown resultId and a missing bpm', async () => {
    const { deps, runtime, resultId } = await searchedSetup();

    await expect(
      handleImportBrandMusic(deps, STORE, { id: 'mine' }, brandRequest({ slug: 'pitch-deck', resultId: 'nope', bpm: 90, mood: 'x' }), runtime),
    ).rejects.toMatchObject({ code: 'MUSIC_RESULT_UNKNOWN' });
    await expect(
      handleImportBrandMusic(deps, STORE, { id: 'mine' }, brandRequest({ slug: 'pitch-deck', resultId, mood: 'x' }), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a duplicated track id', async () => {
    const { deps, runtime, resultId } = await searchedSetup();
    const payload = { slug: 'pitch-deck', resultId, bpm: 90, mood: 'calm' };

    await handleImportBrandMusic(deps, STORE, { id: 'mine' }, brandRequest(payload), runtime);

    await expect(handleImportBrandMusic(deps, STORE, { id: 'mine' }, brandRequest(payload), runtime)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
