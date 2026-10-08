import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleCopyAsset } from './asset-copy-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const COPY_ASSET_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.copy_asset.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function copyRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/assets/copy`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

describe('handleCopyAsset', () => {
  it('answers 201 with exactly the copy_asset output keys and copies without deleting the source', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleCopyAsset(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      copyRequest('pitch-deck', { from: 'raw/aroll/clip01.mp4', role: 'aroll', filename: 'clip01-copy.mp4' }),
      runtime,
    );

    expect(response.status).toBe(201);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(COPY_ASSET_OUTPUT_KEYS);
    expect(body).toEqual({ path: 'raw/aroll/clip01-copy.mp4' });

    expect(await storage.stat(`${PROJECT_ROOT}/raw/aroll/clip01.mp4`)).not.toBeNull();
    expect(await storage.stat(`${PROJECT_ROOT}/raw/aroll/clip01-copy.mp4`)).not.toBeNull();
  });

  it('rejects an invalid role with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCopyAsset(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        copyRequest('pitch-deck', { from: 'raw/aroll/clip01.mp4', role: 'bogus', filename: 'x.mp4' }),
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a non-portable filename with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCopyAsset(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        copyRequest('pitch-deck', { from: 'raw/aroll/clip01.mp4', role: 'aroll', filename: '../escape.mp4' }),
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a source path outside the project with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCopyAsset(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        copyRequest('pitch-deck', { from: '/etc/passwd', role: 'aroll', filename: 'x.mp4' }),
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a missing source with 404 FILE_NOT_FOUND', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCopyAsset(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        copyRequest('pitch-deck', { from: 'raw/aroll/missing.mp4', role: 'aroll', filename: 'x.mp4' }),
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('rejects an existing destination with 409 ASSET_EXISTS and never touches the source', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [
        { path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' },
        { path: `${PROJECT_ROOT}/raw/aroll/clip01-copy.mp4`, contents: 'already there' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCopyAsset(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        copyRequest('pitch-deck', { from: 'raw/aroll/clip01.mp4', role: 'aroll', filename: 'clip01-copy.mp4' }),
        runtime,
      ),
    ).rejects.toMatchObject({ code: 'ASSET_EXISTS' });

    expect(callLog.ports()).not.toContain('copyFile');
  });
});
