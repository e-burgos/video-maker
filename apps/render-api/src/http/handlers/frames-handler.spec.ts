import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { handleExtractFrames } from './frames-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const FRAMES_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.extract_frames.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function framesRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/frames`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

describe('handleExtractFrames', () => {
  it('answers 200 with exactly the extract_frames output keys and one path per timestamp', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const response = await handleExtractFrames(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      framesRequest('pitch-deck', { path: 'raw/aroll/clip01.mp4', atSeconds: [0, 2.5] }),
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(FRAMES_OUTPUT_KEYS);
    expect(body.frames).toEqual([
      { atSeconds: 0, path: 'work/producer/frames/t0.jpg' },
      { atSeconds: 2.5, path: 'work/producer/frames/t2500.jpg' },
    ]);
    expect(callLog.ports()).toContain('extractFrame');
  });

  it('calls extractFrame once per timestamp with the resolved absolute paths', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await handleExtractFrames(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      framesRequest('pitch-deck', { path: 'raw/aroll/clip01.mp4', atSeconds: [1] }),
    );

    const calls = callLog.entries().filter((entry) => entry.port === 'extractFrame');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toMatchObject({
      path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`,
      atSeconds: 1,
      outPath: `${PROJECT_ROOT}/work/producer/frames/t1000.jpg`,
      maxLongSidePx: 768,
      projectRoot: PROJECT_ROOT,
    });
  });

  it('rejects zero timestamps with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleExtractFrames(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        framesRequest('pitch-deck', { path: 'raw/aroll/clip01.mp4', atSeconds: [] }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects more than 12 timestamps with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleExtractFrames(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        framesRequest('pitch-deck', {
          path: 'raw/aroll/clip01.mp4',
          atSeconds: Array.from({ length: 13 }, (_, index) => index),
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects a source path outside the project with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleExtractFrames(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        framesRequest('pitch-deck', { path: '../../etc/passwd', atSeconds: [0] }),
      ),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a source path that does not exist with 404 FILE_NOT_FOUND', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleExtractFrames(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        framesRequest('pitch-deck', { path: 'raw/aroll/missing.mp4', atSeconds: [0] }),
      ),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });
});
