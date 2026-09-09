import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { ENGINE_MODULE_NAMES } from '../engine/engine-modules';
import { MEDIA_BINARY_NAMES } from '../engine/media-binaries';
import { JSON_CONTENT_TYPE } from './http-message';
import { handleHealth } from './health-handler';
import type { HealthBody } from './health-handler';

const FIXED_NOW_ISO = '2026-09-08T00:00:00.000Z';

describe('handleHealth', () => {
  it('answers 200 with status ok, the service name, the clock time and one entry per engine module and media binary', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const response = await handleHealth(deps);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('render-api');
    expect(body.time).toBe(FIXED_NOW_ISO);
    expect(body.engine).toHaveLength(ENGINE_MODULE_NAMES.length);
    expect(body.binaries).toHaveLength(MEDIA_BINARY_NAMES.length);
    expect(body.capabilities).toEqual({ renderPipeline: true, assetStore: true, jobQueue: false });
  });

  it('answers 200 with status degraded when a media binary does not resolve', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      probeMediaBinaries: async () => [
        { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
        { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: false },
      ],
    });

    const response = await handleHealth(deps);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
  });

  it('answers capabilities.assetStore true and cycle 2', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const response = await handleHealth(deps);
    const body = response.body as HealthBody;

    expect(body.capabilities.assetStore).toBe(true);
    expect(body.cycle).toBe(2);
  });

  it('keeps answering 200 in the degraded state with assetStore still true', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      preloadEngineModules: async () => [
        { name: 'media-local', loaded: false },
        { name: 'composition-remotion/render', loaded: true },
      ],
    });

    const response = await handleHealth(deps);
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.capabilities.assetStore).toBe(true);
  });

  it('never exposes a resolved binary path', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const response = await handleHealth(deps);
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
