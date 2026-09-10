import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createControllableRenderMutedVideo } from '../__fixtures__/controllable-render';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import { JSON_CONTENT_TYPE } from './http-message';
import { handleHealth } from './health-handler';
import type { HealthBody } from './health-handler';
import { createRenderApiRuntime } from './render-api-runtime';

const FIXED_NOW_ISO = '2026-09-08T00:00:00.000Z';
const PROJECT_ROOT = '/var/data/media/acme-launch';

const ALL_BINARIES_RESOLVED = [
  { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
  { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
  { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
  { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
  { name: 'piperCli', envVar: 'PIPER_PATH', resolved: true },
  { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: true },
] as const;

function emptyRuntime() {
  return createRenderApiRuntime(createFakeRenderApiDependencies(createCallLog()));
}

describe('handleHealth', () => {
  it('answers 200 with status ok, the service name, the clock time and one entry per engine module and media binary', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => ALL_BINARIES_RESOLVED,
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('render-api');
    expect(body.time).toBe(FIXED_NOW_ISO);
    expect(body.engine).toHaveLength(ENGINE_MODULE_NAMES.length);
    expect(body.binaries).toHaveLength(MEDIA_BINARY_NAMES.length);
    expect(body.capabilities).toEqual({
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      assembleQueue: true,
    });
  });

  it('degrada el servicio cuando falta la voz de Piper, con los otros cinco binarios resueltos (US-09-002)', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => [
        ...ALL_BINARIES_RESOLVED.slice(0, 5),
        { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: false },
      ],
    });

    const response = await handleHealth(deps, emptyRuntime());
    const body = response.body as HealthBody;

    expect(body.status).toBe('degraded');
    expect(body.binaries.filter((binary) => !binary.resolved)).toEqual([
      { name: 'piperModel', envVar: 'PIPER_MODEL_PATH', resolved: false },
    ]);
  });

  it('reporta los binarios de Piper por nombre lógico y env var, nunca por la ruta resuelta (US-09-002)', async () => {
    const response = await handleHealth(
      createFakeRenderApiDependencies(createCallLog()),
      emptyRuntime(),
    );
    const body = response.body as HealthBody;

    expect(body.binaries.map((binary) => binary.name)).toEqual([...MEDIA_BINARY_NAMES]);
    expect(JSON.stringify(body)).not.toContain('/usr/bin/piper');
    expect(JSON.stringify(body)).not.toContain('.onnx');
  });

  it('answers 200 with status degraded when the whisper model does not resolve, keeping the other three binaries resolved', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => [
        { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
        { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
        { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
        { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: false },
      ],
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');

    const byName = new Map(body.binaries.map((binary) => [binary.name, binary.resolved]));
    expect(byName.get('ffmpeg')).toBe(true);
    expect(byName.get('ffprobe')).toBe(true);
    expect(byName.get('whisperCli')).toBe(true);
    expect(byName.get('whisperModel')).toBe(false);
  });

  it('serializes exactly the eight top-level HealthBody keys', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => ALL_BINARIES_RESOLVED,
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(Object.keys(body).sort()).toEqual([
      'binaries',
      'capabilities',
      'cycle',
      'engine',
      'jobs',
      'service',
      'status',
      'time',
    ]);
  });

  it('answers capabilities.jobQueue true and cycle 3', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(body.capabilities.jobQueue).toBe(true);
    expect(body.cycle).toBe(3);
  });

  it('reports the running and queued counters of the runtime queue', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const controllable = createControllableRenderMutedVideo();
    const runtime = createRenderApiRuntime(
      createFakeRenderApiDependencies(createCallLog(), { renderMutedVideo: controllable.port }),
    );

    runtime.jobs.create({ kind: 'render', slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    runtime.jobs.create({ kind: 'render', slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(body.jobs).toEqual({ running: 1, queued: 1 });

    controllable.resolve({ outPath: `${PROJECT_ROOT}/work/renders/r/video-muted.mp4`, width: 1080, height: 1920, fps: 30, durationInFrames: 144 });
    await runtime.jobs.whenIdle();
  });

  it('keeps answering 200 with jobQueue true and the same jobs block in the degraded state', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      preloadEngineModules: async () => [
        { name: 'media-local', loaded: false },
        { name: 'composition-remotion/render', loaded: true },
      ],
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.capabilities.jobQueue).toBe(true);
    expect(body.jobs).toEqual(runtime.jobs.size());
  });

  it('never exposes a resolved binary path', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => ALL_BINARIES_RESOLVED,
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('/opt/');
    expect(serialized).not.toContain('/usr/');
    expect(serialized).not.toContain(':\\');
    expect(body.binaries).toHaveLength(MEDIA_BINARY_NAMES.length);

    for (const binary of body.binaries) {
      expect(Object.keys(binary).sort()).toEqual(['envVar', 'name', 'resolved']);
    }
  });
});
