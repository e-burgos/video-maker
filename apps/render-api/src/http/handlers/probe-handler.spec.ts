import { STUDIO_TOOLS } from '@video-maker/producer-tools';
import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { handleProbeMedia } from './probe-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };
const PROJECT_ROOT = `${STORE.mediaRoot}/pitch-deck`;
const PROBE_OUTPUT_KEYS = Object.keys(STUDIO_TOOLS.probe_media.output.shape).sort();

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function probeRequest(slug: string, payload: unknown): ReturnType<typeof requestLine> {
  return requestLine({
    method: 'POST',
    path: `/projects/${slug}/probe`,
    body: toChunks([JSON.stringify(payload)]),
  });
}

const VIDEO_ASSET: MediaAsset = {
  id: 'raw/aroll/clip01.mp4',
  kind: 'video',
  path: 'raw/aroll/clip01.mp4',
  durationMs: 4000,
  fps: 30,
  width: 1080,
  height: 1920,
  hasAudio: true,
  hasAlpha: false,
  videoCodec: 'h264',
  audio: { sampleRate: 48000, channels: 2, codec: 'aac' },
  probedAt: '2026-09-23T00:00:00.000Z',
};

describe('handleProbeMedia', () => {
  it('answers 200 with exactly the probe_media output keys for a video asset', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async () => VIDEO_ASSET,
    });

    const response = await handleProbeMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      probeRequest('pitch-deck', { path: 'raw/aroll/clip01.mp4' }),
    );

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(PROBE_OUTPUT_KEYS);
    expect(body).toEqual({
      path: 'raw/aroll/clip01.mp4',
      durationMs: 4000,
      video: {
        width: 1080,
        height: 1920,
        fps: 30,
        frames: 120,
        codec: 'h264',
        hasAlpha: false,
      },
      audio: { channels: 2, sampleRate: 48000, codec: 'aac' },
    });
  });

  it('answers video: null and audio: null for an audio-only asset', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/audio/music.wav`, contents: 'bytes' }],
    });
    const audioAsset: MediaAsset = {
      id: 'raw/audio/music.wav',
      kind: 'audio',
      path: 'raw/audio/music.wav',
      durationMs: 9000,
      audio: { sampleRate: 44100, channels: 2, codec: 'pcm_s16le' },
      probedAt: '2026-09-23T00:00:00.000Z',
    };
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async () => audioAsset,
    });

    const response = await handleProbeMedia(
      deps,
      STORE,
      { slug: 'pitch-deck' },
      probeRequest('pitch-deck', { path: 'raw/audio/music.wav' }),
    );

    const body = response.body as Record<string, unknown>;
    expect(body.video).toBeNull();
    expect(body.audio).toEqual({ channels: 2, sampleRate: 44100, codec: 'pcm_s16le' });
  });

  it('rejects a missing path with 422 INVALID_INPUT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleProbeMedia(deps, STORE, { slug: 'pitch-deck' }, probeRequest('pitch-deck', {})),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an absolute path with 403 PATH_OUTSIDE_PROJECT', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleProbeMedia(deps, STORE, { slug: 'pitch-deck' }, probeRequest('pitch-deck', { path: '/etc/passwd' })),
    ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects a path that does not exist with 404 FILE_NOT_FOUND', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(
      handleProbeMedia(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        probeRequest('pitch-deck', { path: 'raw/aroll/missing.mp4' }),
      ),
    ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('translates a ffprobe command failure into MEDIA_COMMAND_FAILED', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'bytes' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async () => {
        throw Object.assign(new Error('ffprobe exited with code 1'), { code: 'COMMAND_FAILED' });
      },
    });

    await expect(
      handleProbeMedia(
        deps,
        STORE,
        { slug: 'pitch-deck' },
        probeRequest('pitch-deck', { path: 'raw/aroll/clip01.mp4' }),
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_COMMAND_FAILED' });
  });
});
