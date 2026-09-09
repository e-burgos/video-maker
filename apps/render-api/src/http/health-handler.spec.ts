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

function emptyRuntime() {
  return createRenderApiRuntime(createFakeRenderApiDependencies(createCallLog()));
}

describe('handleHealth', () => {
  it('answers 200 with status ok, the service name, the clock time and one entry per engine module and media binary', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
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
    expect(body.capabilities).toEqual({ renderPipeline: true, assetStore: true, jobQueue: true });
  });

  it('answers 200 with status degraded when a media binary does not resolve', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => [
        { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
        { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: false },
      ],
    });
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
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

    runtime.jobs.create({ slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    runtime.jobs.create({ slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });

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
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = emptyRuntime();

    const response = await handleHealth(deps, runtime);
    const body = response.body as HealthBody;
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('/opt/');
    expect(serialized).not.toContain('/usr/');
    expect(serialized).not.toContain(':\\');

    for (const binary of body.binaries) {
      expect(Object.keys(binary).sort()).toEqual(['envVar', 'name', 'resolved']);
    }
  });
});
