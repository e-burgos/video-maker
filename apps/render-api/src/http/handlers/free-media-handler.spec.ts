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
import { handleImportMedia, handleSearchFreeMedia } from './free-media-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const SEARCH_OUTPUT_SHAPE = (STUDIO_TOOLS.search_free_media.output as ZodObject).shape;
const SEARCH_OUTPUT_KEYS = Object.keys(SEARCH_OUTPUT_SHAPE).sort();
const SEARCH_RESULT_ITEM_KEYS = Object.keys((SEARCH_OUTPUT_SHAPE.results as ZodArray).element.shape).sort();
const IMPORT_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.import_media.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function searchRequest(slug: string, query: string): ReturnType<typeof requestLine> {
  return requestLine({ method: 'GET', path: `/projects/${slug}/media/search?${query}` });
}

function importRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/media/import`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

const COMMONS_VIDEO_SEARCH_PAYLOAD = {
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

const NASA_SEARCH_PAYLOAD = { collection: { items: [] as readonly unknown[] } };

function fetchCommonsAndEmptyNasa() {
  return createFakeFetchRemote((call) => {
    if (call.url.includes('images-api.nasa.gov')) {
      return { status: 200, bodyChunks: jsonBodyChunks(NASA_SEARCH_PAYLOAD) };
    }
    return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_VIDEO_SEARCH_PAYLOAD) };
  });
}

describe('handleSearchFreeMedia', () => {
  it('answers 200 with exactly the search_free_media output keys, without leaking downloadUrl', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = fetchCommonsAndEmptyNasa();
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleSearchFreeMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'query=ocean&kind=video&maxResults=5'),
      runtime,
    );

    expect(response.status).toBe(200);
    const body = response.body as { results: readonly Record<string, unknown>[] };
    expect(Object.keys(body).sort()).toEqual(SEARCH_OUTPUT_KEYS);
    expect(body.results).toHaveLength(1);
    expect(Object.keys(body.results[0] ?? {}).sort()).toEqual(SEARCH_RESULT_ITEM_KEYS);
    expect(body.results[0]).not.toHaveProperty('downloadUrl');
    expect(body.results[0]).toMatchObject({ source: 'commons', kind: 'video', title: 'Ocean Waves.mp4' });
  });

  it('rejects a missing query with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMedia(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'kind=video&maxResults=5'), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an invalid kind with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMedia(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'query=ocean&kind=audio&maxResults=5'), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects maxResults outside 1..10 with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMedia(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'query=ocean&kind=video&maxResults=11'), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('answers 503 MEDIA_SOURCE_UNAVAILABLE when both sources fail', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const { fetchRemote } = createFakeFetchRemote({ status: 500, bodyChunks: textBodyChunks('down') });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleSearchFreeMedia(deps, STORE, { slug: 'pitch-deck' }, searchRequest('pitch-deck', 'query=ocean&kind=video&maxResults=5'), runtime),
    ).rejects.toMatchObject({ code: 'MEDIA_SOURCE_UNAVAILABLE' });
  });
});

describe('handleImportMedia', () => {
  it('answers 404 MEDIA_RESULT_UNKNOWN for a resultId with no prior search', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleImportMedia(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId: 'nope' }), runtime),
    ).rejects.toMatchObject({ code: 'MEDIA_RESULT_UNKNOWN' });
  });

  it('rejects a missing resultId with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleImportMedia(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', {}), runtime),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('downloads a previously searched video into raw/broll/, writes the credit and answers exactly the import_media output keys', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const videoBytes = textBodyChunks('video-bytes');
    let call = 0;
    const { fetchRemote } = createFakeFetchRemote((request) => {
      call += 1;
      if (call === 1) {
        if (request.url.includes('images-api.nasa.gov')) {
          return { status: 200, bodyChunks: jsonBodyChunks(NASA_SEARCH_PAYLOAD) };
        }
        return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_VIDEO_SEARCH_PAYLOAD) };
      }
      if (call === 2 && request.url.includes('images-api.nasa.gov')) {
        return { status: 200, bodyChunks: jsonBodyChunks(NASA_SEARCH_PAYLOAD) };
      }
      return {
        status: 200,
        headers: { 'content-length': String(videoBytes[0]?.byteLength ?? 0) },
        bodyChunks: videoBytes,
      };
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const searchResponse = await handleSearchFreeMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'query=ocean&kind=video&maxResults=5'),
      runtime,
    );
    const resultId = (searchResponse.body as { results: readonly { resultId: string }[] }).results[0]?.resultId;
    expect(resultId).toBeDefined();

    const response = await handleImportMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      importRequest('pitch-deck', { resultId }),
      runtime,
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(IMPORT_OUTPUT_KEYS);
    expect(body.path).toBe('raw/broll/Ocean_Waves.mp4');
    expect(body.credit).toMatchObject({ kind: 'video', title: 'Ocean Waves.mp4', author: 'Jane Doe', license: 'CC BY 3.0' });

    const creditsRaw = await storage.readTextFile(`${PROJECT_ROOT}/work/credits.json`);
    expect(JSON.parse(creditsRaw)).toEqual([body.credit]);
  });

  it('answers 503 MEDIA_SOURCE_UNAVAILABLE when the download fails', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    let call = 0;
    const { fetchRemote } = createFakeFetchRemote((request) => {
      call += 1;
      if (call === 1) {
        if (request.url.includes('images-api.nasa.gov')) {
          return { status: 200, bodyChunks: jsonBodyChunks(NASA_SEARCH_PAYLOAD) };
        }
        return { status: 200, bodyChunks: jsonBodyChunks(COMMONS_VIDEO_SEARCH_PAYLOAD) };
      }
      if (request.url.includes('images-api.nasa.gov')) {
        return { status: 200, bodyChunks: jsonBodyChunks(NASA_SEARCH_PAYLOAD) };
      }
      return { status: 500, bodyChunks: textBodyChunks('down') };
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote });
    const runtime = createRenderApiRuntime(deps);

    const searchResponse = await handleSearchFreeMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      searchRequest('pitch-deck', 'query=ocean&kind=video&maxResults=5'),
      runtime,
    );
    const resultId = (searchResponse.body as { results: readonly { resultId: string }[] }).results[0]?.resultId;

    await expect(
      handleImportMedia(deps, STORE, { slug: 'pitch-deck' }, importRequest('pitch-deck', { resultId }), runtime),
    ).rejects.toMatchObject({ code: 'MEDIA_SOURCE_UNAVAILABLE' });
  });
});
