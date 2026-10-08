import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import { MAX_JSON_BODY_BYTES } from '../read-json-body';
import {
  handleCreateProject,
  handleDeleteProject,
  handleGetProject,
  handleListProjects,
  handlePutProjectPlacement,
} from './projects-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands',
};

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

const PROJECT_SUMMARY_KEYS = ['layout', 'mode', 'slug'];
const PROJECT_DETAIL_KEYS = ['assetCounts', 'assetSource', 'layout', 'mode', 'slug'];
const PLACEMENT_BODY_KEYS = ['placement', 'slug'];
const PLACEMENT_KEYS = ['archived', 'categoryId', 'folderId'];
const DELETE_BODY_KEYS = ['deleted', 'slug'];

describe('handleListProjects', () => {
  it('answers 200 with an empty array when no project was ever created', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleListProjects(deps, STORE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('lists one entry per project row sorted by slug with its layout flags', async () => {
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
      files: [
        { path: `${STORE.mediaRoot}/acme-launch/work/catalog.json`, contents: '{}' },
        { path: `${STORE.mediaRoot}/acme-launch/raw/aroll/clip-0001.mp4`, contents: 'x' },
        { path: `${STORE.mediaRoot}/acme-launch/out/final.mp4`, contents: 'x' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert('zeta-project');
    deps.localStore.projects.insert('acme-launch');

    const response = await handleListProjects(deps, STORE);

    expect(response.body).toEqual([
      {
        slug: 'acme-launch',
        mode: 'footage',
        layout: { raw: true, catalog: true, timeline: false, edl: false, out: true },
      },
      {
        slug: 'zeta-project',
        mode: 'footage',
        layout: { raw: false, catalog: false, timeline: false, edl: false, out: false },
      },
    ]);
    expect(Object.keys(response.body as object).length).toBeGreaterThan(0);
    for (const summary of response.body as readonly unknown[]) {
      expect(Object.keys(summary as object).sort()).toEqual(PROJECT_SUMMARY_KEYS);
    }
  });

  it('does not list a project row whose directory was removed, and does not insert on read', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/valid-project`, `${STORE.mediaRoot}/valid-project/raw`],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    deps.localStore.projects.insert('valid-project');
    deps.localStore.projects.insert('ghost-project');

    const response = await handleListProjects(deps, STORE);

    expect(response.body).toEqual([
      {
        slug: 'valid-project',
        mode: 'footage',
        layout: { raw: false, catalog: false, timeline: false, edl: false, out: false },
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

  it('creates the eight layout directories in order, inserts the row and answers 201 with honest, content-based layout flags (US-017-QA-008: raw/out are empty on a brand-new project)', async () => {
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
    expect(Object.keys(response.body as object).sort()).toEqual(PROJECT_DETAIL_KEYS);
    expect(response.body).toEqual({
      slug: 'smoke-ingest',
      mode: 'footage',
      layout: { raw: false, catalog: false, timeline: false, edl: false, out: false },
      assetSource: 'raw-scan',
      assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0 },
    });
    expect(deps.localStore.projects.exists('smoke-ingest')).toBe(true);

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

  it('answers 409 PROJECT_ALREADY_EXISTS without touching the existing project or inserting a second row', async () => {
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
    expect(deps.localStore.projects.exists('smoke-ingest')).toBe(false);
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
  it('answers 404 PROJECT_NOT_FOUND and 200 with the same keys as before for the detail route', async () => {
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
    expect(Object.keys(response.body as object).sort()).toEqual(PROJECT_DETAIL_KEYS);
    expect(response.body).toMatchObject({
      slug: 'smoke-ingest',
      assetSource: 'raw-scan',
      assetCounts: { aroll: 1, broll: 0, image: 0, audio: 0, voice: 0 },
    });
  });
});

interface SeededPlacement {
  readonly folderId: string | null;
  readonly categoryId: string | null;
  readonly archived: boolean;
}

function projectFixture(slug: string, placement?: SeededPlacement) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [
      `${STORE.mediaRoot}/${slug}`,
      `${STORE.mediaRoot}/${slug}/raw`,
      `${STORE.mediaRoot}/${slug}/out`,
    ],
    files: [{ path: `${STORE.mediaRoot}/${slug}/raw/aroll/take.mp4`, contents: 'video bytes' }],
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  deps.localStore.projects.insert(slug);
  deps.localStore.organization.createFolder('display-ads', 'Display Ads');
  deps.localStore.organization.createCategory('campanas', 'display-ads', 'Campañas');
  if (placement !== undefined) {
    deps.localStore.organization.setPlacement(slug, placement);
  }
  return { callLog, storage, deps };
}

describe('handlePutProjectPlacement', () => {
  it('files the video under a folder and a category', async () => {
    const { deps } = projectFixture('editar-campana');

    const response = await handlePutProjectPlacement(
      deps,
      STORE,
      { slug: 'editar-campana' },
      requestLine({
        method: 'PUT',
        path: '/projects/editar-campana/placement',
        body: jsonBody({ folderId: 'display-ads', categoryId: 'campanas' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(PLACEMENT_BODY_KEYS);
    expect(Object.keys((response.body as { placement: object }).placement).sort()).toEqual(PLACEMENT_KEYS);
    expect(response.body).toEqual({
      slug: 'editar-campana',
      placement: { folderId: 'display-ads', categoryId: 'campanas', archived: false },
    });
  });

  it('archives without moving the video out of its folder', async () => {
    const { deps } = projectFixture('editar-campana', {
      folderId: 'display-ads',
      categoryId: 'campanas',
      archived: false,
    });

    const response = await handlePutProjectPlacement(
      deps,
      STORE,
      { slug: 'editar-campana' },
      requestLine({
        method: 'PUT',
        path: '/projects/editar-campana/placement',
        body: jsonBody({ folderId: 'display-ads', categoryId: 'campanas', archived: true }),
      }),
    );

    expect(response.body).toEqual({
      slug: 'editar-campana',
      placement: { folderId: 'display-ads', categoryId: 'campanas', archived: true },
    });
  });

  it('refuses a folder that does not exist instead of writing a dangling placement', async () => {
    const { deps } = projectFixture('editar-campana');

    const payload = await caughtErrorPayload(
      handlePutProjectPlacement(
        deps,
        STORE,
        { slug: 'editar-campana' },
        requestLine({
          method: 'PUT',
          path: '/projects/editar-campana/placement',
          body: jsonBody({ folderId: 'ghost', categoryId: null }),
        }),
      ),
    );

    expect(payload.code).toBe('FOLDER_NOT_FOUND');
  });

  it('refuses a category that belongs to another folder', async () => {
    const { deps } = projectFixture('editar-campana');
    deps.localStore.organization.createFolder('other', 'Other');

    const payload = await caughtErrorPayload(
      handlePutProjectPlacement(
        deps,
        STORE,
        { slug: 'editar-campana' },
        requestLine({
          method: 'PUT',
          path: '/projects/editar-campana/placement',
          body: jsonBody({ folderId: 'other', categoryId: 'campanas' }),
        }),
      ),
    );

    expect(payload.code).toBe('FOLDER_CATEGORY_NOT_FOUND');
  });

  it('refuses a category with no folder, which would be an orphan', async () => {
    const { deps } = projectFixture('editar-campana');

    const payload = await caughtErrorPayload(
      handlePutProjectPlacement(
        deps,
        STORE,
        { slug: 'editar-campana' },
        requestLine({
          method: 'PUT',
          path: '/projects/editar-campana/placement',
          body: jsonBody({ folderId: null, categoryId: 'campanas' }),
        }),
      ),
    );

    expect(payload.code).toBe('VIDEO_PLACEMENT_INVALID');
  });

  it('answers 404 for a video whose directory is not there', async () => {
    const { deps } = projectFixture('editar-campana');

    const payload = await caughtErrorPayload(
      handlePutProjectPlacement(
        deps,
        STORE,
        { slug: 'never-created' },
        requestLine({
          method: 'PUT',
          path: '/projects/never-created/placement',
          body: jsonBody({ folderId: null, categoryId: null }),
        }),
      ),
    );

    expect(payload.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('handleDeleteProject', () => {
  it('removes the whole directory, the row and cascades the placement', async () => {
    const { deps, callLog } = projectFixture('editar-campana', {
      folderId: 'display-ads',
      categoryId: 'campanas',
      archived: true,
    });

    const response = await handleDeleteProject(deps, STORE, { slug: 'editar-campana' });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(DELETE_BODY_KEYS);
    expect(response.body).toEqual({ slug: 'editar-campana', deleted: true });
    expect(callLog.entries()).toContainEqual({
      port: 'removeDirectory',
      input: `${STORE.mediaRoot}/editar-campana`,
    });

    expect(deps.localStore.projects.exists('editar-campana')).toBe(false);
    expect(deps.localStore.organization.getOrganization().videos).toEqual({});
  });

  it('answers 404 and deletes nothing when the video does not exist', async () => {
    const { deps, callLog } = projectFixture('editar-campana');

    const payload = await caughtErrorPayload(handleDeleteProject(deps, STORE, { slug: 'never-created' }));

    expect(payload.code).toBe('PROJECT_NOT_FOUND');
    expect(callLog.ports()).not.toContain('removeDirectory');
  });

  it('refuses a slug that is not a single kebab-case segment, so no path escapes the media root', async () => {
    const { deps, callLog } = projectFixture('editar-campana');

    const payload = await caughtErrorPayload(handleDeleteProject(deps, STORE, { slug: '../../etc' }));

    expect(payload.code).toBe('PROJECT_SLUG_INVALID');
    expect(callLog.ports()).not.toContain('removeDirectory');
  });
});

describe('project mode', () => {
  async function createWith(body: unknown) {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog);
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({ method: 'POST', path: '/projects', body: jsonBody(body) });
    return { deps, storage, run: () => handleCreateProject(deps, STORE, undefined, request) };
  }

  it('defaults to footage and creates no motion directory', async () => {
    const { deps, storage, run } = await createWith({ slug: 'plain' });

    const response = await run();

    expect((response.body as { mode: string }).mode).toBe('footage');
    expect(deps.localStore.projects.get('plain')?.mode).toBe('footage');
    expect(await storage.stat('/media/plain/motion')).toBeNull();
  });

  it('creates a motion project with its motion directory and reports the mode on GET and list', async () => {
    const { deps, storage, run } = await createWith({ slug: 'promo', mode: 'motion' });

    const created = await run();

    expect((created.body as { mode: string }).mode).toBe('motion');
    expect(deps.localStore.projects.get('promo')?.mode).toBe('motion');
    expect((await storage.stat('/media/promo/motion'))?.kind).toBe('directory');

    const detail = await handleGetProject(deps, STORE, { slug: 'promo' });
    const list = await handleListProjects(deps, STORE);
    expect(Object.keys(detail.body as object).sort()).toEqual(PROJECT_DETAIL_KEYS);
    expect(detail.body).toMatchObject({ mode: 'motion' });
    expect((list.body as { mode: string }[]).map((entry) => entry.mode)).toEqual(['motion']);
  });

  it('rejects an unknown mode with 400 and creates nothing', async () => {
    const { deps, run } = await createWith({ slug: 'promo', mode: 'hologram' });

    const payload = await caughtErrorPayload(run());

    expect(payload.code).toBe('REQUEST_BODY_INVALID_JSON');
    expect(payload.resource).toBe('mode');
    expect(deps.localStore.projects.exists('promo')).toBe(false);
  });
});
