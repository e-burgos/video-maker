import { MaterialReviewSchema } from '@video-maker/timeline-core';
import type { MaterialReviewItem } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { materialReviewPath } from '../../material/material-paths';
import { handleGetMaterialReview, handlePutMaterialReview } from './material-review-handler';
import type { MaterialReviewBody } from './material-review-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/assets', brandsRoot: '/brands' };
const SLUG = 'pitch-deck';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const NOW = '2026-10-12T10:00:00.000Z';

function item(file: string, overrides: Partial<MaterialReviewItem> = {}): MaterialReviewItem {
  return {
    file,
    source: file.startsWith('brand:') ? 'brand' : 'project',
    shows: 'Un equipo sobre una mesa',
    verdict: 'fits',
    reason: 'Se ve completo',
    ...overrides,
  };
}

function viewed(...paths: string[]): string {
  return JSON.stringify({ version: 1, images: paths.map((path) => ({ path, viewedAt: NOW })) });
}

function setup(viewedPaths: readonly string[]) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: viewedPaths.length === 0 ? [] : [{ path: `${PROJECT_ROOT}/work/producer/viewed-images.json`, contents: viewed(...viewedPaths) }],
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage, clock: { nowIso: () => NOW } });
  deps.localStore.projects.insert(SLUG);
  return { deps, storage };
}

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function put(body: unknown) {
  return requestLine({ method: 'PUT', path: `/projects/${SLUG}/material-review`, body: jsonBody(body) });
}

describe('material review handlers (US-023-601)', () => {
  it('answers a null review for a project without one', async () => {
    const { deps } = setup([]);

    const response = await handleGetMaterialReview(deps, STORE, { slug: SLUG });
    const body = response.body as MaterialReviewBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['path', 'review', 'slug', 'warnings']);
    expect(body).toMatchObject({ slug: SLUG, path: materialReviewPath(), review: null, warnings: null });
  });

  it('stores the review once every item was viewed, stamps it and answers the warnings', async () => {
    const { deps, storage } = setup(['raw/images/a.png', 'brand:counter-15']);
    const items = [item('images/a.png'), item('brand:counter-15', { verdict: 'unfit', reason: 'Muestra un menú de comida' })];

    const response = await handlePutMaterialReview(deps, STORE, { slug: SLUG }, put({ items, gaps: [{ need: 'Easy Pro en un TV', note: 'ninguna foto' }] }));
    const body = response.body as MaterialReviewBody;

    expect(response.status).toBe(200);
    expect(body.review).toMatchObject({ version: 1, reviewedAt: NOW });
    expect(body.warnings?.items.map((entry) => entry.file)).toEqual(['brand:counter-15']);
    expect(body.warnings?.gaps).toHaveLength(1);
    const stored = MaterialReviewSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/${materialReviewPath()}`)));
    expect(stored.items).toHaveLength(2);
    const again = await handleGetMaterialReview(deps, STORE, { slug: SLUG });
    expect((again.body as MaterialReviewBody).review).toEqual(stored);
  });

  it('refuses an item that was never viewed, naming it, and stores nothing', async () => {
    const { deps, storage } = setup(['raw/images/a.png']);

    const attempt = handlePutMaterialReview(deps, STORE, { slug: SLUG }, put({ items: [item('images/a.png'), item('brand:counter-15'), item('raw/images/b.png')], gaps: [] }));

    await expect(attempt).rejects.toMatchObject({ code: 'MATERIAL_NOT_VIEWED', resource: 'brand:counter-15, raw/images/b.png' });
    expect(httpStatusFor('MATERIAL_NOT_VIEWED')).toBe(422);
    expect(await storage.stat(`${PROJECT_ROOT}/${materialReviewPath()}`)).toBeNull();
  });

  it.each([
    [{ gaps: [] }],
    [{ items: [item('images/a.png', { verdict: 'great' as never })], gaps: [] }],
    [{ items: [item('brand:x', { source: 'project' })], gaps: [] }],
    [{ items: [], gaps: [{ need: 'x' }] }],
  ])('rejects a malformed review with MATERIAL_REVIEW_INVALID (%#)', async (payload) => {
    const { deps } = setup(['raw/images/a.png', 'brand:x']);

    await expect(handlePutMaterialReview(deps, STORE, { slug: SLUG }, put(payload))).rejects.toMatchObject({ code: 'MATERIAL_REVIEW_INVALID' });
    expect(httpStatusFor('MATERIAL_REVIEW_INVALID')).toBe(422);
  });

  it('accepts an empty review with a gap when the project has no images at all', async () => {
    const { deps } = setup([]);

    const response = await handlePutMaterialReview(deps, STORE, { slug: SLUG }, put({ items: [], gaps: [{ need: 'foto del equipo', note: 'no hay material' }] }));

    expect((response.body as MaterialReviewBody).warnings?.gaps).toHaveLength(1);
  });
});
