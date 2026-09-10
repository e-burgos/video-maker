import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import { MAX_JSON_BODY_BYTES } from '../read-json-body';
import { handleCreateProject, handleGetProject, handleListProjects } from './projects-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

async function* textBody(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

function jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  return textBody(JSON.stringify(value));
}

async function caughtErrorPayload(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('handleListProjects', () => {
  it('answers 200 with an empty array when the media root does not exist', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleListProjects(deps, STORE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('lists one entry per project directory sorted by slug with its layout flags', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [
        `${STORE.mediaRoot}/zeta-project`,
        `${STORE.mediaRoot}/zeta-project/raw`,
        `${STORE.mediaRoot}/zeta-project/out`,
        `${STORE.mediaRoot}/acme-launch`,
        `${STORE.mediaRoot}/acme-launch/raw`,
        `${STORE.mediaRoot}/acme-launch/out`,
      ],
      files: [{ path: `${STORE.mediaRoot}/acme-launch/work/catalog.json`, contents: '{}' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleListProjects(deps, STORE);

    expect(response.body).toEqual([
      {
        slug: 'acme-launch',
        layout: { raw: true, catalog: true, timeline: false, edl: false, out: true },
      },
      {
        slug: 'zeta-project',
        layout: { raw: true, catalog: false, timeline: false, edl: false, out: true },
      },
    ]);
  });

  it('ignores files and non-portable directory names under the media root', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [
        `${STORE.mediaRoot}/Not_Valid`,
        `${STORE.mediaRoot}/valid-project`,
        `${STORE.mediaRoot}/valid-project/raw`,
      ],
      files: [{ path: `${STORE.mediaRoot}/stray-file.txt`, contents: 'x' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleListProjects(deps, STORE);

    expect(response.body).toEqual([
      {
        slug: 'valid-project',
        layout: { raw: true, catalog: false, timeline: false, edl: false, out: false },
      },
    ]);
  });
});

describe('handleCreateProject', () => {
  it('rejects an invalid slug with PROJECT_SLUG_INVALID before invoking any storage port', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const request = requestLine({ method: 'POST', path: '/projects', body: jsonBody({ slug: 'Not Valid' }) });

    await expect(handleCreateProject(deps, STORE, undefined, request)).rejects.toMatchObject({
      code: 'PROJECT_SLUG_INVALID',
    });
    expect(callLog.ports()).toEqual([]);
  });

  it('creates the eight layout directories in order and answers 201 with catalog, timeline and edl false', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'POST',
      path: '/projects',
      body: jsonBody({ slug: 'smoke-ingest' }),
    });

    const response = await handleCreateProject(deps, STORE, undefined, request);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/projects/smoke-ingest');
    expect(response.body).toEqual({
      slug: 'smoke-ingest',
      layout: { raw: true, catalog: false, timeline: false, edl: false, out: true },
      assetSource: 'raw-scan',
      assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0 },
    });

    const ensureDirectoryCalls = callLog
      .entries()
      .filter((entry) => entry.port === 'ensureDirectory')
      .map((entry) => entry.input);
    expect(ensureDirectoryCalls).toEqual([
      `${STORE.mediaRoot}/smoke-ingest/raw/aroll`,
      `${STORE.mediaRoot}/smoke-ingest/raw/broll`,
      `${STORE.mediaRoot}/smoke-ingest/raw/images`,
      `${STORE.mediaRoot}/smoke-ingest/raw/audio`,
      `${STORE.mediaRoot}/smoke-ingest/raw/voice`,
      `${STORE.mediaRoot}/smoke-ingest/raw/logo`,
      `${STORE.mediaRoot}/smoke-ingest/work`,
      `${STORE.mediaRoot}/smoke-ingest/out`,
    ]);
  });

  it('answers 409 PROJECT_ALREADY_EXISTS without touching the existing project', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'POST',
      path: '/projects',
      body: jsonBody({ slug: 'smoke-ingest' }),
    });

    await expect(handleCreateProject(deps, STORE, undefined, request)).rejects.toMatchObject({
      code: 'PROJECT_ALREADY_EXISTS',
    });
    expect(callLog.ports()).not.toContain('ensureDirectory');
  });

  it('answers 400 REQUEST_BODY_INVALID_JSON and 413 REQUEST_BODY_TOO_LARGE for a malformed body', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const invalidJsonRequest = requestLine({
      method: 'POST',
      path: '/projects',
      body: textBody('not json'),
    });
    await expect(handleCreateProject(deps, STORE, undefined, invalidJsonRequest)).rejects.toMatchObject({
      code: 'REQUEST_BODY_INVALID_JSON',
    });

    const notAnObjectRequest = requestLine({
      method: 'POST',
      path: '/projects',
      body: textBody(JSON.stringify(['smoke-ingest'])),
    });
    await expect(handleCreateProject(deps, STORE, undefined, notAnObjectRequest)).rejects.toMatchObject({
      code: 'REQUEST_BODY_INVALID_JSON',
    });

    const missingSlugRequest = requestLine({
      method: 'POST',
      path: '/projects',
      body: textBody(JSON.stringify({ slug: 123 })),
    });
    await expect(handleCreateProject(deps, STORE, undefined, missingSlugRequest)).rejects.toMatchObject({
      code: 'REQUEST_BODY_INVALID_JSON',
    });

    const tooLargeRequest = requestLine({
      method: 'POST',
      path: '/projects',
      body: textBody(JSON.stringify({ slug: `${'x'.repeat(MAX_JSON_BODY_BYTES)}` })),
    });
    await expect(handleCreateProject(deps, STORE, undefined, tooLargeRequest)).rejects.toMatchObject({
      code: 'REQUEST_BODY_TOO_LARGE',
    });
  });

  it('answers the exact same error for an empty body as for a syntactically invalid one', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const invalidJsonRequest = requestLine({ method: 'POST', path: '/projects', body: textBody('not json') });
    const emptyBodyRequest = requestLine({ method: 'POST', path: '/projects' });

    const invalidJsonPayload = await caughtErrorPayload(
      handleCreateProject(deps, STORE, undefined, invalidJsonRequest),
    );
    const emptyBodyPayload = await caughtErrorPayload(
      handleCreateProject(deps, STORE, undefined, emptyBodyRequest),
    );

    expect(Object.keys(emptyBodyPayload).sort()).toEqual(Object.keys(invalidJsonPayload).sort());
    expect(emptyBodyPayload).toEqual(invalidJsonPayload);
    expect(emptyBodyPayload.code).toBe('REQUEST_BODY_INVALID_JSON');
  });
});

describe('handleGetProject', () => {
  it('answers 404 PROJECT_NOT_FOUND and 200 with assetCounts for the detail route', async () => {
    const missingCallLog = createCallLog();
    const missingDeps = createFakeRenderApiDependencies(missingCallLog, {
      storage: createFakeObjectStorage(missingCallLog),
    });
    await expect(handleGetProject(missingDeps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });

    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [
        `${STORE.mediaRoot}/smoke-ingest`,
        `${STORE.mediaRoot}/smoke-ingest/raw`,
        `${STORE.mediaRoot}/smoke-ingest/raw/aroll`,
      ],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleGetProject(deps, STORE, { slug: 'smoke-ingest' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: 'smoke-ingest',
      assetSource: 'raw-scan',
      assetCounts: { aroll: 1, broll: 0, image: 0, audio: 0, voice: 0 },
    });
  });
});
