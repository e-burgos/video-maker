import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createControllableRenderMutedVideo } from '../../__fixtures__/controllable-render';
import type { FakeObjectStorageSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../../__fixtures__/minimal-timeline';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import type { RenderJob } from '../../jobs/render-job';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleCancelRenderJob,
  handleCreateRenderJob,
  handleGetRenderJob,
  handleListRenderJobs,
} from './jobs-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = '/var/data/media/acme-launch';
const DEFAULT_RENDER_OUTPUT = {
  outPath: `${PROJECT_ROOT}/work/renders/r/video-muted.mp4`,
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 144,
};

function isAsciiOnly(text: string): boolean {
  return Array.from(text).every((character) => character.charCodeAt(0) < 128);
}

describe('handleCreateRenderJob', () => {
  it('answers 202 with a service-generated id and enqueues exactly one job', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleCreateRenderJob(deps, STORE, { slug: 'smoke-ingest' }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(202);
    expect(response.headers.location).toBe(`/jobs/${body.id}`);
    expect(runtime.jobs.listBySlug('smoke-ingest')).toHaveLength(1);
    expect(runtime.jobs.listBySlug('smoke-ingest')[0]?.id).toBe(body.id);

    await runtime.jobs.whenIdle();
  });

  interface RejectionCase {
    readonly title: string;
    readonly code: string;
    readonly slug: string;
    readonly seed?: FakeObjectStorageSeed;
  }

  const REJECTION_CASES: readonly RejectionCase[] = [
    { title: 'PROJECT_SLUG_INVALID', code: 'PROJECT_SLUG_INVALID', slug: 'Not_A_Slug' },
    { title: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND', slug: 'missing-project' },
    {
      title: 'TIMELINE_NOT_FOUND',
      code: 'TIMELINE_NOT_FOUND',
      slug: 'smoke-ingest',
      seed: { directories: [`${STORE.mediaRoot}/smoke-ingest`] },
    },
    {
      title: 'TIMELINE_INVALID',
      code: 'TIMELINE_INVALID',
      slug: 'smoke-ingest',
      seed: {
        directories: [`${STORE.mediaRoot}/smoke-ingest`],
        files: [
          { path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify({ not: 'valid' }) },
        ],
      },
    },
  ];

  it.each(REJECTION_CASES)('answers $code and registers no job', async ({ code, slug, seed }) => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, seed);
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(handleCreateRenderJob(deps, STORE, { slug }, runtime)).rejects.toMatchObject({ code });
    expect(runtime.jobs.listBySlug(slug)).toEqual([]);
  });
});

describe('handleListRenderJobs', () => {
  it('answers 200 with an empty jobs array for a slug without jobs', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const response = await handleListRenderJobs({ slug: 'smoke-ingest' }, runtime);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ slug: 'smoke-ingest', jobs: [] });
  });
});

describe('handleGetRenderJob', () => {
  it('answers 404 RENDER_JOB_NOT_FOUND for an id that was never created', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    await expect(handleGetRenderJob({ jobId: 'unknown-id' }, runtime)).rejects.toMatchObject({
      code: 'RENDER_JOB_NOT_FOUND',
    });
  });

  it('answers 200 with state failed and the embedded typed error', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      muxAudioIntoVideo: async () => {
        throw new Error('mux exploded');
      },
    });
    const runtime = createRenderApiRuntime(deps);

    const job = runtime.jobs.create({ slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    await runtime.jobs.whenIdle();

    const response = await handleGetRenderJob({ jobId: job.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(200);
    expect(body.state).toBe('failed');
    expect(body.error?.code).toBe('INTERNAL_ERROR');
    expect(body.error?.stage).toBe('mux');
  });
});

describe('handleCancelRenderJob', () => {
  it('answers 200 with state canceled for a queued job', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const runtime = createRenderApiRuntime(deps);

    runtime.jobs.create({ slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    const second = runtime.jobs.create({
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    expect(second.state).toBe('queued');

    const response = await handleCancelRenderJob({ jobId: second.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(200);
    expect(body.state).toBe('canceled');

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await runtime.jobs.whenIdle();
  });

  it('answers 202 with state canceling for a running job', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const runtime = createRenderApiRuntime(deps);

    const job = runtime.jobs.create({ slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    await controllable.started;

    const response = await handleCancelRenderJob({ jobId: job.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(202);
    expect(body.state).toBe('canceling');

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await runtime.jobs.whenIdle();
  });

  const TERMINAL_STATES: ReadonlyArray<{
    readonly title: 'succeeded' | 'failed' | 'canceled';
    readonly settle: (controllable: ReturnType<typeof createControllableRenderMutedVideo>) => void;
  }> = [
    { title: 'succeeded', settle: (controllable) => controllable.resolve(DEFAULT_RENDER_OUTPUT) },
    { title: 'failed', settle: (controllable) => controllable.reject(new Error('render exploded')) },
    { title: 'canceled', settle: (controllable) => controllable.resolve(DEFAULT_RENDER_OUTPUT) },
  ];

  it.each(TERMINAL_STATES)(
    'answers 409 RENDER_JOB_NOT_CANCELABLE and leaves the state untouched ($title)',
    async ({ title, settle }) => {
      const callLog = createCallLog();
      const controllable = createControllableRenderMutedVideo();
      const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
      const runtime = createRenderApiRuntime(deps);

      const job = runtime.jobs.create({
        slug: 'acme-launch',
        projectRoot: PROJECT_ROOT,
        timeline: buildMinimalTimeline(),
      });
      await controllable.started;

      if (title === 'canceled') {
        runtime.jobs.cancel(job.id);
      }
      settle(controllable);
      await runtime.jobs.whenIdle();

      expect(runtime.jobs.get(job.id)?.state).toBe(title);

      await expect(handleCancelRenderJob({ jobId: job.id }, runtime)).rejects.toMatchObject({
        code: 'RENDER_JOB_NOT_CANCELABLE',
      });
      expect(runtime.jobs.get(job.id)?.state).toBe(title);
    },
  );

  it('answers 404 RENDER_JOB_NOT_FOUND when cancelling an id that was never created', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    await expect(handleCancelRenderJob({ jobId: 'unknown-id' }, runtime)).rejects.toMatchObject({
      code: 'RENDER_JOB_NOT_FOUND',
    });
  });

  it('answers the two queue errors with a payload free of stack, of Spanish text and of absolute paths', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const notFoundError = await handleCancelRenderJob({ jobId: 'unknown-id' }, runtime).catch(
      (error: unknown) => error,
    );
    const notFoundPayload = toErrorPayload(notFoundError);

    expect(notFoundPayload.code).toBe('RENDER_JOB_NOT_FOUND');
    expect(isAsciiOnly(notFoundPayload.message)).toBe(true);
    expect('stack' in notFoundPayload).toBe(false);
    expect(notFoundPayload.resource?.startsWith('/')).toBe(false);

    const job = runtime.jobs.create({
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    await runtime.jobs.whenIdle();

    const notCancelableError = await handleCancelRenderJob({ jobId: job.id }, runtime).catch(
      (error: unknown) => error,
    );
    const notCancelablePayload = toErrorPayload(notCancelableError);

    expect(notCancelablePayload.code).toBe('RENDER_JOB_NOT_CANCELABLE');
    expect(isAsciiOnly(notCancelablePayload.message)).toBe(true);
    expect('stack' in notCancelablePayload).toBe(false);
    expect(notCancelablePayload.resource?.startsWith('/')).toBe(false);
  });
});
