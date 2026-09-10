import { sceneAssignmentPath, serializeMontageDocument } from '@video-maker/auto-montage';
import type { SceneAssignment } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { buildStoryboardDocument } from '../../__fixtures__/storyboard-fixtures';
import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { handleGetScenes, handleImportScenes, handlePutScenes } from './scenes-handler';
import type { SceneImportBody, ScenesBody } from './scenes-handler';

const STORE: StoreConfig = { mediaRoot: '/var/data/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const SLUG = 'acme-launch';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const DOCUMENT = buildStoryboardDocument();

function absolute(relativePath: string): string {
  return `${PROJECT_ROOT}/${relativePath}`;
}

async function* textBody(value: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(value);
}

function jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  return textBody(JSON.stringify(value));
}

function assignmentWith(entries: readonly { sceneId: string; assetId: string }[]): SceneAssignment {
  return { schemaVersion: 1, storyboardId: DOCUMENT.id, assignments: [...entries] };
}

function createDeps(options?: {
  readonly assignment?: SceneAssignment;
  readonly assignmentJson?: unknown;
  readonly withStoryboard?: boolean;
  readonly rawFiles?: readonly string[];
}): { deps: RenderApiDependencies; storage: ReturnType<typeof createFakeObjectStorage> } {
  const callLog = createCallLog();
  const files = [
    ...(options?.withStoryboard === false
      ? []
      : [{ path: absolute('work/storyboard.json'), contents: serializeMontageDocument(DOCUMENT) }]),
    ...(options?.assignment === undefined && options?.assignmentJson === undefined
      ? []
      : [
          {
            path: absolute(sceneAssignmentPath()),
            contents: JSON.stringify(options.assignmentJson ?? options.assignment),
          },
        ]),
    ...(options?.rawFiles ?? []).map((path) => ({ path: absolute(path), contents: 'BINARY' })),
  ];

  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  return { deps, storage };
}

describe('handleGetScenes (US-10-003)', () => {
  it('answers 200 with one slot per storyboard scene and an empty assignment when none is stored', async () => {
    const { deps } = createDeps();

    const response = await handleGetScenes(deps, STORE, { slug: SLUG });
    const body = response.body as ScenesBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['assignment', 'path', 'slots', 'slug', 'storyboardId']);
    expect(body.storyboardId).toBe(DOCUMENT.id);
    expect(body.assignment.assignments).toEqual([]);
    expect(body.slots).toHaveLength(3);
  });

  it('shows the prompt of every slot and the asset the storyboard already names for an asset scene', async () => {
    const { deps } = createDeps();

    const body = (await handleGetScenes(deps, STORE, { slug: SLUG })).body as ScenesBody;

    expect(body.slots[0]).toEqual({
      sceneId: 'scene-01',
      index: 1,
      visualSource: 'upload',
      visualPrompt: DOCUMENT.scenes[0]?.visualPrompt,
      assetId: null,
    });
    expect(body.slots[2]?.assetId).toBe('raw/broll/desk.mp4');
  });

  it('reflects the stored assignment on the upload slot', async () => {
    const { deps } = createDeps({ assignment: assignmentWith([{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }]) });

    const body = (await handleGetScenes(deps, STORE, { slug: SLUG })).body as ScenesBody;

    expect(body.slots[0]?.assetId).toBe('raw/images/01.png');
  });

  it('fails with STORYBOARD_NOT_FOUND when the project has no storyboard to assign visuals to', async () => {
    const { deps } = createDeps({ withStoryboard: false });

    await expect(handleGetScenes(deps, STORE, { slug: SLUG })).rejects.toMatchObject({
      code: 'STORYBOARD_NOT_FOUND',
    });
  });

  it('fails with SCENES_INVALID when the stored document does not match its schema', async () => {
    const { deps } = createDeps({ assignmentJson: { schemaVersion: 2, assignments: [] } });

    await expect(handleGetScenes(deps, STORE, { slug: SLUG })).rejects.toMatchObject({ code: 'SCENES_INVALID' });
  });
});

describe('handlePutScenes (US-10-003)', () => {
  it('stores the assignment with the montage writer and answers with the refreshed slots', async () => {
    const { deps, storage } = createDeps();
    const assignment = assignmentWith([{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }]);

    const response = await handlePutScenes(
      deps,
      STORE,
      { slug: SLUG },
      requestLine({ method: 'PUT', path: `/projects/${SLUG}/scenes`, body: jsonBody(assignment) }),
    );
    const body = response.body as ScenesBody;

    expect(response.status).toBe(200);
    expect(body.path).toBe(sceneAssignmentPath());
    expect(body.slots[0]?.assetId).toBe('raw/images/01.png');
    expect(await storage.readTextFile(absolute(sceneAssignmentPath()))).toBe(serializeMontageDocument(assignment));
  });

  it('rejects an assignment for a scene the storyboard does not have', async () => {
    const { deps } = createDeps();
    const assignment = assignmentWith([{ sceneId: 'scene-99', assetId: 'raw/images/01.png' }]);

    await expect(
      handlePutScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'PUT', path: `/projects/${SLUG}/scenes`, body: jsonBody(assignment) }),
      ),
    ).rejects.toMatchObject({ code: 'SCENE_NOT_FOUND', resource: 'scene-99' });
  });

  it('rejects an assignment written against a different storyboard', async () => {
    const { deps } = createDeps();
    const assignment: SceneAssignment = {
      schemaVersion: 1,
      storyboardId: 'storyboard-other',
      assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/01.png' }],
    };

    await expect(
      handlePutScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'PUT', path: `/projects/${SLUG}/scenes`, body: jsonBody(assignment) }),
      ),
    ).rejects.toMatchObject({ code: 'SCENES_INVALID', resource: 'storyboardId' });
  });

  it('rejects a body that is not a JSON object', async () => {
    const { deps } = createDeps();

    await expect(
      handlePutScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'PUT', path: `/projects/${SLUG}/scenes`, body: jsonBody([1, 2]) }),
      ),
    ).rejects.toMatchObject({ code: 'REQUEST_BODY_INVALID_JSON' });
  });

  it('rejects an empty body instead of storing an empty assignment', async () => {
    const { deps } = createDeps();

    await expect(
      handlePutScenes(deps, STORE, { slug: SLUG }, requestLine({ method: 'PUT', path: `/projects/${SLUG}/scenes` })),
    ).rejects.toMatchObject({ code: 'REQUEST_BODY_INVALID_JSON' });
  });
});

describe('handleImportScenes (US-10-002)', () => {
  it('maps every numbered file under raw to the scene of its number', async () => {
    const { deps } = createDeps({
      rawFiles: ['raw/broll/01.mp4', 'raw/images/02-terminal.png', 'raw/broll/scene-03.mov'],
    });

    const response = await handleImportScenes(
      deps,
      STORE,
      { slug: SLUG },
      requestLine({ method: 'POST', path: `/projects/${SLUG}/scenes/import` }),
    );
    const body = response.body as SceneImportBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'assignment',
      'imported',
      'path',
      'skipped',
      'slots',
      'slug',
      'storyboardId',
    ]);
    expect(body.imported).toBe(3);
    expect(body.assignment.assignments).toEqual([
      { sceneId: 'scene-01', assetId: 'raw/broll/01.mp4' },
      { sceneId: 'scene-02', assetId: 'raw/images/02-terminal.png' },
      { sceneId: 'scene-03', assetId: 'raw/broll/scene-03.mov' },
    ]);
  });

  it('reports the files that match no scene instead of dropping them silently', async () => {
    const { deps } = createDeps({ rawFiles: ['raw/broll/final.mp4', 'raw/broll/09.mp4'] });

    const body = (
      await handleImportScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'POST', path: `/projects/${SLUG}/scenes/import` }),
      )
    ).body as SceneImportBody;

    expect(body.imported).toBe(0);
    expect(body.skipped).toEqual([
      { assetId: 'raw/broll/09.mp4', reason: 'no-scene-for-number' },
      { assetId: 'raw/broll/final.mp4', reason: 'no-leading-number' },
    ]);
  });

  it('keeps an assignment the import does not touch, and replaces it when asked to', async () => {
    const stored = assignmentWith([{ sceneId: 'scene-02', assetId: 'raw/images/kept.png' }]);

    const merged = (
      await handleImportScenes(
        createDeps({ assignment: stored, rawFiles: ['raw/broll/01.mp4'] }).deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'POST', path: `/projects/${SLUG}/scenes/import` }),
      )
    ).body as SceneImportBody;

    const replaced = (
      await handleImportScenes(
        createDeps({ assignment: stored, rawFiles: ['raw/broll/01.mp4'] }).deps,
        STORE,
        { slug: SLUG },
        requestLine({
          method: 'POST',
          path: `/projects/${SLUG}/scenes/import`,
          body: jsonBody({ replace: true }),
        }),
      )
    ).body as SceneImportBody;

    expect(merged.assignment.assignments).toEqual([
      { sceneId: 'scene-01', assetId: 'raw/broll/01.mp4' },
      { sceneId: 'scene-02', assetId: 'raw/images/kept.png' },
    ]);
    expect(replaced.assignment.assignments).toEqual([{ sceneId: 'scene-01', assetId: 'raw/broll/01.mp4' }]);
  });

  it('only looks at the roles it was asked for', async () => {
    const { deps } = createDeps({ rawFiles: ['raw/broll/01.mp4', 'raw/images/02.png'] });

    const body = (
      await handleImportScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({
          method: 'POST',
          path: `/projects/${SLUG}/scenes/import`,
          body: jsonBody({ roles: ['image'] }),
        }),
      )
    ).body as SceneImportBody;

    expect(body.assignment.assignments).toEqual([{ sceneId: 'scene-02', assetId: 'raw/images/02.png' }]);
  });

  it('rejects a roles list that is not made of asset roles', async () => {
    const { deps } = createDeps();

    await expect(
      handleImportScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({
          method: 'POST',
          path: `/projects/${SLUG}/scenes/import`,
          body: jsonBody({ roles: ['pictures'] }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'SCENE_IMPORT_ROLES_INVALID' });
  });

  it('rejects a replace flag that is not a boolean', async () => {
    const { deps } = createDeps();

    await expect(
      handleImportScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({
          method: 'POST',
          path: `/projects/${SLUG}/scenes/import`,
          body: jsonBody({ replace: 'yes' }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'SCENE_IMPORT_REPLACE_INVALID' });
  });

  it('writes an empty assignment when raw has nothing numbered to import', async () => {
    const { deps, storage } = createDeps();

    const body = (
      await handleImportScenes(
        deps,
        STORE,
        { slug: SLUG },
        requestLine({ method: 'POST', path: `/projects/${SLUG}/scenes/import` }),
      )
    ).body as SceneImportBody;

    expect(body.imported).toBe(0);
    expect(await storage.readTextFile(absolute(sceneAssignmentPath()))).toContain('"assignments": []');
  });
});
