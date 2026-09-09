import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createControllableRenderMutedVideo } from '../__fixtures__/controllable-render';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { createRecordingLogger } from '../__fixtures__/recording-logger';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderPipelineStage } from '../errors/render-api-error';
import type { CreateRenderJobInput } from './render-job-queue';
import { createRenderJobQueue } from './render-job-queue';

const PROJECT_ROOT = '/var/data/media/acme-launch';

function createInput(slug: string): CreateRenderJobInput {
  return { slug, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() };
}

const DEFAULT_RENDER_OUTPUT = {
  outPath: `${PROJECT_ROOT}/work/renders/r/video-muted.mp4`,
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 144,
};

describe('createRenderJobQueue', () => {
  it('keeps the second job queued while the first is running', async () => {
    const callLog = createCallLog();
    const logger = createRecordingLogger();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, {
      logger,
      renderMutedVideo: controllable.port,
    });
    const queue = createRenderJobQueue(deps);

    const first = queue.create(createInput('acme-launch'));
    const second = queue.create(createInput('acme-launch'));

    expect(first.state).toBe('running');
    expect(second.state).toBe('queued');
    expect(queue.size()).toEqual({ running: 1, queued: 1 });
    expect(logger.events()).toEqual([
      {
        event: 'render-job-transition',
        detail: { jobId: first.id, slug: 'acme-launch', from: 'queued', to: 'running' },
      },
    ]);

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();

    expect(queue.get(first.id)?.state).toBe('succeeded');
    expect(queue.get(second.id)?.state).toBe('succeeded');
  });

  const TERMINAL_CASES: ReadonlyArray<{ readonly title: 'succeeded' | 'failed' | 'canceled' }> = [
    { title: 'succeeded' },
    { title: 'failed' },
    { title: 'canceled' },
  ];

  it.each(TERMINAL_CASES)(
    'dispatches the queued job only after the running one reaches $title',
    async ({ title }) => {
      const callLog = createCallLog();
      const controllable = createControllableRenderMutedVideo();
      let renderCalls = 0;
      const deps = createFakeRenderApiDependencies(callLog, {
        renderMutedVideo: async (input) => {
          renderCalls += 1;
          if (renderCalls === 1) {
            return controllable.port(input);
          }
          return { ...DEFAULT_RENDER_OUTPUT, outPath: input.outPath };
        },
      });
      const queue = createRenderJobQueue(deps);

      const first = queue.create(createInput('acme-launch'));
      const second = queue.create(createInput('acme-launch'));

      expect(second.state).toBe('queued');

      await controllable.started;

      if (title === 'canceled') {
        queue.cancel(first.id);
      }

      if (title === 'failed') {
        controllable.reject(new Error('render exploded'));
      } else {
        controllable.resolve(DEFAULT_RENDER_OUTPUT);
      }

      await queue.whenIdle();

      expect(queue.get(first.id)?.state).toBe(title);
      expect(queue.get(second.id)?.state).toBe('succeeded');
    },
  );

  it('lists only the jobs of the given slug in creation order', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const queue = createRenderJobQueue(deps);

    const alphaFirst = queue.create(createInput('alpha'));
    queue.create(createInput('beta'));
    const alphaSecond = queue.create(createInput('alpha'));

    const alphaJobs = queue.listBySlug('alpha');

    expect(alphaJobs.map((job) => job.id)).toEqual([alphaFirst.id, alphaSecond.id]);
    expect(queue.listBySlug('missing-slug')).toEqual([]);

    await queue.whenIdle();
  });

  it('exposes stage render and a percent that never decreases between two snapshots', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput('acme-launch'));
    await controllable.started;

    controllable.emitProgress(120, 538);
    expect(queue.get(job.id)?.progress).toEqual({
      stage: 'render',
      renderedFrames: 120,
      totalFrames: 538,
      percent: 22,
    });

    controllable.emitProgress(119, 538);
    expect(queue.get(job.id)?.progress).toEqual({
      stage: 'render',
      renderedFrames: 120,
      totalFrames: 538,
      percent: 22,
    });

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();
  });

  it('cancels a queued job without invoking any pipeline port', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const queue = createRenderJobQueue(deps);

    queue.create(createInput('acme-launch'));
    const second = queue.create(createInput('acme-launch'));
    expect(second.state).toBe('queued');

    const portsBeforeCancel = callLog.ports();
    const result = queue.cancel(second.id);

    expect(result).toEqual({
      kind: 'canceled',
      job: expect.objectContaining({ id: second.id, state: 'canceled' }),
    });
    expect(callLog.ports()).toEqual(portsBeforeCancel);
    expect(queue.get(second.id)?.finishedAt).not.toBeNull();

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();
  });

  it('moves a running job to canceling and settles it as canceled at the next stage checkpoint', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput('acme-launch'));
    await controllable.started;

    const result = queue.cancel(job.id);
    expect(result).toEqual({
      kind: 'canceling',
      job: expect.objectContaining({ id: job.id, state: 'canceling' }),
    });

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.state).toBe('canceled');
    expect(finished?.report).toBeNull();
    expect(finished?.error).toBeNull();
    expect(finished?.finishedAt).not.toBeNull();
  });

  it('settles a canceling job as canceled and discards the report when the pipeline completed', async () => {
    const callLog = createCallLog();
    let cancelJob: (() => void) | null = null;
    const deps = createFakeRenderApiDependencies(callLog, {
      verifyMixLoudness: async () => {
        cancelJob?.();
        return {
          measured: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 6, thresholdLufs: -24, targetOffsetDb: 0 },
          withinTolerance: true,
          integratedDeltaLu: 0,
          truePeakDeltaDb: 0,
        };
      },
    });
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput('acme-launch'));
    cancelJob = () => {
      queue.cancel(job.id);
    };

    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.state).toBe('canceled');
    expect(finished?.report).toBeNull();
  });

  it('answers canceling again without changing anything when the job is already canceling', async () => {
    const callLog = createCallLog();
    const logger = createRecordingLogger();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { logger, renderMutedVideo: controllable.port });
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput('acme-launch'));
    await controllable.started;

    const firstCancel = queue.cancel(job.id);
    const eventsAfterFirstCancel = logger.events().length;
    const secondCancel = queue.cancel(job.id);

    expect(firstCancel).toEqual({
      kind: 'canceling',
      job: expect.objectContaining({ id: job.id, state: 'canceling' }),
    });
    expect(secondCancel).toEqual({
      kind: 'canceling',
      job: expect.objectContaining({ id: job.id, state: 'canceling' }),
    });
    expect(logger.events().length).toBe(eventsAfterFirstCancel);

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();
  });

  const STAGE_FAILURE_CASES: ReadonlyArray<{
    readonly stage: RenderPipelineStage;
    readonly code: string;
    readonly overrides: Partial<RenderApiDependencies>;
  }> = [
    {
      stage: 'prepare',
      code: 'WORKDIR_UNWRITABLE',
      overrides: {
        ensureDirectory: async () => {
          throw new Error('EACCES');
        },
      },
    },
    {
      stage: 'render',
      code: 'INTERNAL_ERROR',
      overrides: {
        renderMutedVideo: async () => {
          throw new Error('render exploded');
        },
      },
    },
    {
      stage: 'mix',
      code: 'INTERNAL_ERROR',
      overrides: {
        mixTimelineAudio: async () => {
          throw new Error('mix exploded');
        },
      },
    },
    {
      stage: 'mux',
      code: 'INTERNAL_ERROR',
      overrides: {
        muxAudioIntoVideo: async () => {
          throw new Error('mux exploded');
        },
      },
    },
    {
      stage: 'verify',
      code: 'INTERNAL_ERROR',
      overrides: {
        verifyMixLoudness: async () => {
          throw new Error('verify exploded');
        },
      },
    },
  ];

  it.each(STAGE_FAILURE_CASES)(
    'settles the job as failed with the typed error of the $stage stage',
    async ({ stage, code, overrides }) => {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog, overrides);
      const queue = createRenderJobQueue(deps);

      const job = queue.create(createInput('acme-launch'));
      await queue.whenIdle();

      const finished = queue.get(job.id);
      expect(finished?.state).toBe('failed');
      expect(finished?.error?.stage).toBe(stage);
      expect(finished?.error?.code).toBe(code);
    },
  );

  it('reports out/<id>.mp4 as the deliverable and both intermediates under work/renders/<id>/', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput('acme-launch'));
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.report?.deliverable.resource).toBe(`out/${job.id}.mp4`);
    expect(finished?.report?.intermediates.mutedVideoResource).toBe(`work/renders/${job.id}/video-muted.mp4`);
    expect(finished?.report?.intermediates.masterAudioResource).toBe(`work/renders/${job.id}/master.wav`);
  });

  it('never invokes a removal port for a finished job', async () => {
    const succeededCallLog = createCallLog();
    const succeededQueue = createRenderJobQueue(createFakeRenderApiDependencies(succeededCallLog));
    succeededQueue.create(createInput('acme-launch'));
    await succeededQueue.whenIdle();
    expect(succeededCallLog.ports()).not.toContain('removeTemporary');

    const failedCallLog = createCallLog();
    const failedQueue = createRenderJobQueue(
      createFakeRenderApiDependencies(failedCallLog, {
        muxAudioIntoVideo: async () => {
          throw new Error('mux exploded');
        },
      }),
    );
    failedQueue.create(createInput('acme-launch'));
    await failedQueue.whenIdle();
    expect(failedCallLog.ports()).not.toContain('removeTemporary');

    const canceledCallLog = createCallLog();
    const canceledControllable = createControllableRenderMutedVideo();
    const canceledQueue = createRenderJobQueue(
      createFakeRenderApiDependencies(canceledCallLog, { renderMutedVideo: canceledControllable.port }),
    );
    const canceledJob = canceledQueue.create(createInput('acme-launch'));
    await canceledControllable.started;
    canceledQueue.cancel(canceledJob.id);
    canceledControllable.resolve(DEFAULT_RENDER_OUTPUT);
    await canceledQueue.whenIdle();
    expect(canceledCallLog.ports()).not.toContain('removeTemporary');
  });
});
