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
import { handleImportMusic, handleSearchFreeMusic } from './music-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const SEARCH_OUTPUT_SHAPE = (STUDIO_TOOLS.search_free_music.output as ZodObject).shape;
const SEARCH_OUTPUT_KEYS = Object.keys(SEARCH_OUTPUT_SHAPE).sort();
const SEARCH_RESULT_ITEM_KEYS = Object.keys((SEARCH_OUTPUT_SHAPE.results as ZodArray).element.shape).sort();
const IMPORT_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.import_music.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function searchRequest(slug: string, query: string): ReturnType<typeof requestLine> {
  return requestLine({ method: 'GET', path: `/projects/${slug}/music/search?${query}` });
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
    let call = 0;
    const { fetchRemote } = createFakeFetchRemote(() => {
      call += 1;
      if (call === 1) {
        return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) };
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
    let call = 0;
    const { fetchRemote } = createFakeFetchRemote(() => {
      call += 1;
      if (call === 1) {
        return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_SEARCH_PAYLOAD) };
      }
      return { status: 500, bodyChunks: textBodyChunks('down') };
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

    await expect(
      handleImportMusic(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId }), runtime),
    ).rejects.toMatchObject({ code: 'MUSIC_SOURCE_UNAVAILABLE' });
  });
});
