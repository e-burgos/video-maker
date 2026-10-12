import { ReviewReportSchema } from '@video-maker/timeline-core';
import type { ReviewReport, SceneVisualReview } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { handlePutVisualReview } from './visual-review-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/assets', brandsRoot: '/brands' };
const SLUG = 'pitch-deck';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const REVIEW_CREATED = '2026-10-12T10:00:00.000Z';
const AFTER = '2026-10-12T10:05:00.000Z';
const BEFORE = '2026-10-12T09:00:00.000Z';
const NOW = '2026-10-12T10:10:00.000Z';
const FRAME_ONE = 'out/video.review/scene-01.jpg';
const FRAME_TWO = 'out/video.review/scene-02.jpg';

const REPORT: ReviewReport = {
  version: 1,
  file: 'out/video.mp4',
  createdAt: REVIEW_CREATED,
  status: 'fail',
  delivery: { kind: 'motion' },
  metrics: {},
  findings: [{ id: 'visual-not-reviewed-01', check: 'visual-not-reviewed', severity: 'critical', message: 'Nadie miró', proposedFix: 'Mirar' }],
  sceneFrames: [
    { sceneId: 'hook', index: 1, startSec: 0, endSec: 4, atSec: 2, frame: FRAME_ONE, voice: 'Hola' },
    { sceneId: 'cta', index: 2, startSec: 4, endSec: 10, atSec: 7, frame: FRAME_TWO },
  ],
};

function scene(sceneId: string, overrides: Partial<SceneVisualReview> = {}): SceneVisualReview {
  return { sceneId, shows: 'Un título', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok', note: '', ...overrides };
}

interface SetupOptions {
  readonly viewed?: readonly { path: string; viewedAt: string }[];
  readonly report?: ReviewReport | null;
}

function setup({ viewed = [{ path: FRAME_ONE, viewedAt: AFTER }, { path: FRAME_TWO, viewedAt: AFTER }], report = REPORT }: SetupOptions = {}) {
  const callLog = createCallLog();
  const files = [
    { path: `${PROJECT_ROOT}/work/producer/viewed-images.json`, contents: JSON.stringify({ version: 1, images: viewed }) },
    ...(report === null ? [] : [{ path: `${PROJECT_ROOT}/out/video.review.json`, contents: JSON.stringify(report) }]),
  ];
  const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT], files });
  const deps = createFakeRenderApiDependencies(callLog, { storage, clock: { nowIso: () => NOW } });
  deps.localStore.projects.insert(SLUG);
  return { deps, storage };
}

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function put(body: unknown, file: string | null = 'out/video.mp4') {
  const query = file === null ? '' : `?file=${encodeURIComponent(file)}`;
  return requestLine({ method: 'PUT', path: `/projects/${SLUG}/reviews/visual${query}`, body: jsonBody(body) });
}

async function storedReport(storage: ReturnType<typeof setup>['storage']): Promise<ReviewReport> {
  return ReviewReportSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/out/video.review.json`)));
}

describe('PUT /projects/:slug/reviews/visual (US-023-603)', () => {
  it('records the review, clears visual-not-reviewed and stores the status again', async () => {
    const { deps, storage } = setup();

    const response = await handlePutVisualReview(deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook'), scene('cta')] }));

    expect(response.status).toBe(200);
    const body = ReviewReportSchema.parse(response.body);
    expect(body.status).toBe('pass');
    expect(body.findings).toEqual([]);
    expect(body.visualReview).toMatchObject({ recordedAt: NOW });
    expect(await storedReport(storage)).toEqual(body);
  });

  it('turns flagged scenes into critical findings with the scene time range', async () => {
    const { deps } = setup();

    const response = await handlePutVisualReview(
      deps,
      STORE,
      { slug: SLUG },
      put({ scenes: [scene('hook', { verdict: 'fix', note: 'El título se corta' }), scene('cta', { couldBeOtherProduct: true, note: 'Mostrar el equipo' })] }),
    );

    const body = ReviewReportSchema.parse(response.body);
    expect(body.status).toBe('fail');
    expect(body.findings.map((finding) => [finding.check, finding.timeRange])).toEqual([
      ['visual-review', { startSec: 0, endSec: 4 }],
      ['visual-review', { startSec: 4, endSec: 10 }],
    ]);
  });

  it('refuses frames that were never viewed, naming them, and stores nothing', async () => {
    const { deps, storage } = setup({ viewed: [{ path: FRAME_ONE, viewedAt: AFTER }] });

    const attempt = handlePutVisualReview(deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook'), scene('cta')] }));

    await expect(attempt).rejects.toMatchObject({ code: 'VISUAL_REVIEW_NOT_VIEWED', resource: FRAME_TWO });
    expect(httpStatusFor('VISUAL_REVIEW_NOT_VIEWED')).toBe(422);
    expect((await storedReport(storage)).visualReview).toBeUndefined();
  });

  it('refuses frames viewed before the review was created', async () => {
    const { deps } = setup({ viewed: [{ path: FRAME_ONE, viewedAt: BEFORE }, { path: FRAME_TWO, viewedAt: AFTER }] });

    await expect(handlePutVisualReview(deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook'), scene('cta')] }))).rejects.toMatchObject({
      code: 'VISUAL_REVIEW_NOT_VIEWED',
      resource: FRAME_ONE,
    });
  });

  it.each([
    ['a missing scene', { scenes: [scene('hook')] }],
    ['an unknown scene', { scenes: [scene('hook'), scene('cta'), scene('ghost')] }],
    ['a repeated scene', { scenes: [scene('hook'), scene('hook'), scene('cta')] }],
    ['a flagged scene without a note', { scenes: [scene('hook', { verdict: 'fix' }), scene('cta')] }],
    ['an unknown verdict', { scenes: [scene('hook', { verdict: 'meh' as never }), scene('cta')] }],
    ['no scenes', { scenes: [] }],
    ['no body fields', {}],
  ])('rejects %s with VISUAL_REVIEW_INVALID', async (_label, payload) => {
    const { deps } = setup();

    await expect(handlePutVisualReview(deps, STORE, { slug: SLUG }, put(payload))).rejects.toMatchObject({ code: 'VISUAL_REVIEW_INVALID' });
    expect(httpStatusFor('VISUAL_REVIEW_INVALID')).toBe(422);
  });

  it('rejects a render whose report has no scene frames', async () => {
    const { deps } = setup({ report: { ...REPORT, sceneFrames: [] } });

    await expect(handlePutVisualReview(deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook')] }))).rejects.toMatchObject({ code: 'VISUAL_REVIEW_INVALID' });
  });

  it('answers REVIEW_NOT_FOUND without a review and REVIEW_FILE_INVALID without a valid file', async () => {
    const missing = setup({ report: null });
    const invalid = setup();

    await expect(handlePutVisualReview(missing.deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook')] }))).rejects.toMatchObject({ code: 'REVIEW_NOT_FOUND' });
    await expect(handlePutVisualReview(invalid.deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook')] }, null))).rejects.toMatchObject({ code: 'REVIEW_FILE_INVALID' });
    await expect(handlePutVisualReview(invalid.deps, STORE, { slug: SLUG }, put({ scenes: [scene('hook')] }, '../x.mp4'))).rejects.toMatchObject({ code: 'REVIEW_FILE_INVALID' });
  });
});
