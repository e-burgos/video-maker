import type { MotionPipelinePorts } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import type { Job } from '../../jobs/render-job';
import { parseStoredJob, parseStoredParams, toStoredParams } from '../../jobs/job-persistence';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleCreateRenderJob, handleRetryRenderJob } from './jobs-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets', brandsRoot: '/brands',
};

const JOB_KEYS = ['createdAt', 'error', 'finishedAt', 'id', 'kind', 'progress', 'report', 'slug', 'startedAt', 'state'];

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function unreadablePorts(): MotionPipelinePorts {
  const fail = async (): Promise<never> => {
    throw new Error('disk unreadable');
  };
  return {
    assetsRoot: '/assets',
    readText: fail,
    readBytes: fail,
    writeText: fail,
    exists: fail,
    copyTree: fail,
    copyFile: fail,
    removeFile: fail,
    synthesize: fail,
    transcribe: fail,
    detectBeats: fail,
    trimAudio: fail,
    render: fail,
    askAgent: fail,
  };
}

function harness(mode: 'motion' | 'footage', files: readonly FakeObjectStorageFileSeed[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { directories: ['/media/promo'], files });
  const deps = createFakeRenderApiDependencies(callLog, { storage, motionPorts: unreadablePorts });
  deps.localStore.projects.insert('promo', null, mode);
  return { deps, runtime: createRenderApiRuntime(deps) };
}

function create(h: ReturnType<typeof harness>, body: Record<string, unknown>) {
  return handleCreateRenderJob(
    h.deps,
    STORE,
    { slug: 'promo' },
    requestLine({ method: 'POST', path: '/projects/promo/jobs', body: jsonBody({ kind: 'motion', ...body }) }),
    h.runtime,
  );
}

async function errorOf(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

const BRIEF_FILE = { path: '/media/promo/motion/brief.json', contents: '{}' };
const STORYBOARD_FILE = { path: '/media/promo/motion/storyboard.json', contents: '{}' };
const OUTPUT_FILE = { path: '/media/promo/out/video.mp4', contents: 'mp4' };

describe('motion job creation', () => {
  it('answers 202 with the shared job envelope and queues a motion job with the defaults', async () => {
    const h = harness('motion', [BRIEF_FILE]);

    const response = await create(h, { overwrite: true });
    const job = response.body as Job;

    expect(response.status).toBe(202);
    expect(job.kind).toBe('motion');
    expect(Object.keys(job).sort()).toEqual(JOB_KEYS);
    expect(h.runtime.jobs.listBySlug('promo')).toHaveLength(1);
    await h.runtime.jobs.whenIdle();
  });

  it('runs through the shared queue and settles failed with the stage when the pipeline cannot start', async () => {
    const h = harness('motion', [BRIEF_FILE]);

    const response = await create(h, { phase: 'storyboard', overwrite: true });
    await h.runtime.jobs.whenIdle();

    const settled = h.runtime.jobs.get((response.body as Job).id);
    expect(settled?.state).toBe('failed');
    expect(settled?.error?.stage).toBe('storyboard');
  });

  it('answers 409 MOTION_PROJECT_REQUIRED for a footage project', async () => {
    const payload = await errorOf(create(harness('footage', [BRIEF_FILE]), {}));

    expect(payload.code).toBe('MOTION_PROJECT_REQUIRED');
  });

  it('answers 409 BRIEF_MISSING for storyboard and all phases without a brief', async () => {
    for (const phase of ['storyboard', 'all']) {
      const payload = await errorOf(create(harness('motion'), { phase }));
      expect(payload.code).toBe('BRIEF_MISSING');
    }
  });

  it('answers 409 STORYBOARD_MISSING for the video phase without a storyboard', async () => {
    const payload = await errorOf(create(harness('motion', [BRIEF_FILE]), { phase: 'video' }));

    expect(payload.code).toBe('STORYBOARD_MISSING');
  });

  it('answers 409 STORYBOARD_ALREADY_EXISTS unless overwrite is true', async () => {
    const h = harness('motion', [BRIEF_FILE, STORYBOARD_FILE]);

    expect((await errorOf(create(h, { phase: 'storyboard' }))).code).toBe('STORYBOARD_ALREADY_EXISTS');
    expect((await create(h, { phase: 'storyboard', overwrite: true })).status).toBe(202);
    await h.runtime.jobs.whenIdle();
  });

  it('answers 409 ASSET_EXISTS when the output exists and overwrite is not set', async () => {
    const h = harness('motion', [STORYBOARD_FILE, OUTPUT_FILE]);

    const payload = await errorOf(create(h, { phase: 'video' }));

    expect(payload).toMatchObject({ code: 'ASSET_EXISTS', resource: 'out/video.mp4' });
    expect((await create(h, { phase: 'video', overwrite: true })).status).toBe(202);
    await h.runtime.jobs.whenIdle();
  });

  it('rejects invalid parameters with MOTION_JOB_INPUT_INVALID', async () => {
    const payload = await errorOf(create(harness('motion', [BRIEF_FILE]), { takes: 99 }));

    expect(payload.code).toBe('MOTION_JOB_INPUT_INVALID');
  });

  it('queues a motion sample with the stored seconds and lets it ignore an existing output', async () => {
    const h = harness('motion', [STORYBOARD_FILE, OUTPUT_FILE]);

    const response = await create(h, { phase: 'video', sample: { seconds: 10 } });
    await h.runtime.jobs.whenIdle();

    expect(response.status).toBe(202);
    const row = h.deps.localStore.jobs.get((response.body as Job).id);
    expect(row?.params).toMatchObject({ kind: 'motion', phase: 'video', sample: { seconds: 10 } });
  });

  it('rejects a sample outside 8 to 20 seconds with INVALID_INPUT and a sample of the storyboard phase', async () => {
    const h = harness('motion', [BRIEF_FILE, STORYBOARD_FILE]);

    expect((await errorOf(create(h, { phase: 'video', sample: { seconds: 5 } }))).code).toBe('INVALID_INPUT');
    expect((await errorOf(create(h, { phase: 'storyboard', overwrite: true, sample: { seconds: 10 } }))).code).toBe('MOTION_JOB_INPUT_INVALID');
    expect(h.runtime.jobs.listBySlug('promo')).toEqual([]);
  });

  it('retries a failed motion job with the stored parameters', async () => {
    const h = harness('motion', [BRIEF_FILE]);
    const first = await create(h, { phase: 'storyboard', takes: 3, overwrite: true });
    await h.runtime.jobs.whenIdle();

    const retry = await handleRetryRenderJob(h.deps, STORE, { jobId: (first.body as Job).id }, h.runtime);
    await h.runtime.jobs.whenIdle();

    expect(retry.status).toBe(202);
    expect((retry.body as Job).kind).toBe('motion');
  });
});

describe('motion job persistence', () => {
  it('round-trips the stored parameters and rejects malformed ones', () => {
    const stored = toStoredParams({ kind: 'motion', slug: 'promo', projectRoot: '/media/promo', phase: 'video', output: 'v.mp4', takes: 4 });

    expect(stored).toEqual({ kind: 'motion', phase: 'video', output: 'v.mp4', takes: 4 });
    expect(parseStoredParams('motion', stored)).toEqual(stored);
    expect(parseStoredParams('motion', { ...stored, phase: 'nope' })).toBeNull();
    expect(parseStoredParams('motion', { phase: 'video', output: 1, takes: 4 })).toBeNull();
  });

  it('reads a stored motion row back as a typed motion job', () => {
    const job = parseStoredJob({
      id: 'j1',
      slug: 'promo',
      kind: 'motion',
      state: 'succeeded',
      params: {},
      progress: { stage: 'render', linesVoiced: null, totalLines: null, percent: 80 },
      report: { path: 'out/v.mp4', durationSec: 10, scenes: 3, storyboard: null },
      error: null,
      createdAt: 'c',
      startedAt: 's',
      finishedAt: 'f',
      retryOf: null,
    });

    expect(job).toMatchObject({ kind: 'motion', state: 'succeeded', report: { scenes: 3 } });
  });
});
