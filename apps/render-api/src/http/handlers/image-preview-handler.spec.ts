import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { handlePreviewImages } from './image-preview-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const PREVIEW_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.view_images.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function previewRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/images/preview`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

describe('handlePreviewImages', () => {
  it('answers 200 with exactly the view_images output keys and one preview per path', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/images/photo.jpg`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handlePreviewImages(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      previewRequest('pitch-deck', { paths: ['raw/images/photo.jpg'] }),
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(PREVIEW_OUTPUT_KEYS);
    const previews = body.previews as readonly { path: string; previewPath: string }[];
    expect(previews).toHaveLength(1);
    expect(previews[0]?.path).toBe('raw/images/photo.jpg');
    expect(previews[0]?.previewPath).toMatch(/^work\/frames\/previews\/.+\.jpg$/);
    expect(callLog.ports()).toContain('resizeImage');
  });

  it('calls resizeImage (never extractFrame: -ss breaks single-frame image2 inputs) with the 1280px preview cap', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/images/photo.jpg`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: ['raw/images/photo.jpg'] }));

    expect(callLog.entries().filter((entry) => entry.port === 'extractFrame')).toHaveLength(0);
    const calls = callLog.entries().filter((entry) => entry.port === 'resizeImage');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toMatchObject({
      path: `${PROJECT_ROOT}/raw/images/photo.jpg`,
      maxLongSidePx: 1280,
      projectRoot: PROJECT_ROOT,
    });
  });

  it('reuses the same preview path for the same source path (deterministic naming)', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/images/photo.jpg`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const first = await handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: ['raw/images/photo.jpg'] }));
    const second = await handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: ['raw/images/photo.jpg'] }));

    const firstPreviews = (first.body as { previews: readonly { previewPath: string }[] }).previews;
    const secondPreviews = (second.body as { previews: readonly { previewPath: string }[] }).previews;
    expect(firstPreviews[0]?.previewPath).toBe(secondPreviews[0]?.previewPath);
  });

  it('rejects zero paths with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: [] })),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects more than 6 paths with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePreviewImages(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        previewRequest('pitch-deck', { paths: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg', 'g.jpg'] }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a source path outside the project with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: ['../../etc/passwd'] })),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a source path that does not exist with 404 FILE_NOT_FOUND', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handlePreviewImages(deps, STORE, { slug: 'pitch-deck' }, previewRequest('pitch-deck', { paths: ['raw/images/missing.jpg'] })),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });
});
