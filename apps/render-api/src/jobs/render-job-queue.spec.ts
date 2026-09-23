import type { DirectoryReader, FileStatReader } from '@video-maker/auto-montage';
import type { ResolvedBinaries } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import type { CallLog } from '../__fixtures__/call-log';
import { createControllableRenderMutedVideo } from '../__fixtures__/controllable-render';
import type { FakeCommandResponse } from '../__fixtures__/fake-command-runner';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { createRecordingLogger } from '../__fixtures__/recording-logger';
import type { ObjectStorage } from '../deps/object-storage';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderPipelineStage } from '../errors/render-api-error';
import type { CreateMontageJobInput, CreateRenderJobInput } from './render-job';
import { createRenderJobQueue, recoverInterruptedJobs } from './render-job-queue';

const PROJECT_ROOT = '/var/data/media/acme-launch';
const MONTAGE_PROJECT_ROOT = '/var/data/media/montage-project';

function ensureProject(deps: RenderApiDependencies, slug: string): void {
  if (!deps.localStore.projects.exists(slug)) {
    deps.localStore.projects.insert(slug);
  }
}

function createInput(deps: RenderApiDependencies, slug: string): CreateRenderJobInput {
  ensureProject(deps, slug);
  return { kind: 'render', slug, projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() };
}

function createMontageInput(deps: RenderApiDependencies, slug: string): CreateMontageJobInput {
  ensureProject(deps, slug);
  return {
    kind: 'montage',
    slug,
    projectRoot: MONTAGE_PROJECT_ROOT,
    preset: 'software-demo',
    seed: 0,
    scriptPath: null,
    scriptText: null,
    logo: 'auto',
    format: 'reels-9x16',
    voice: 'aroll',
  };
}

const MONTAGE_BINARIES: ResolvedBinaries = {
  ffmpeg: '/opt/media-tools/bin/ffmpeg',
  ffprobe: '/opt/media-tools/bin/ffprobe',
  whisperCli: '/opt/media-tools/bin/whisper-cli',
  whisperModel: '/opt/media-tools/share/ggml-model.bin',
};

const VIDEO_PROBE_STDOUT = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_type: 'video',
      width: 1280,
      height: 720,
      r_frame_rate: '30/1',
      avg_frame_rate: '30/1',
      duration: '8.000000',
    },
  ],
  format: { filename: 'clip01.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '8.000000' },
});

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 300 }, text: ' hola' },
    { offsets: { from: 300, to: 600 }, text: ' vamos' },
  ],
});

function toDirectoryReader(storage: ObjectStorage): DirectoryReader {
  return {
    readDirectory: async (path) => {
      const entries = await storage.listDirectory(path);
      if (entries === null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entries;
    },
  };
}

function toFileStatReader(storage: ObjectStorage): FileStatReader {
  return {
    statFile: async (path) => {
      const stat = await storage.stat(path);
      if (stat === null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return { sizeBytes: stat.sizeBytes, modifiedAtMs: stat.modifiedAtMs };
    },
  };
}

function createControllableResponse(): {
  readonly started: Promise<void>;
  readonly respond: (response: FakeCommandResponse) => void;
  readonly factory: () => Promise<FakeCommandResponse>;
} {
  let resolveStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  let resolveResponse!: (response: FakeCommandResponse) => void;
  const promise = new Promise<FakeCommandResponse>((resolve) => {
    resolveResponse = resolve;
  });
  return {
    started,
    respond: (response) => resolveResponse(response),
    factory: () => {
      resolveStarted();
      return promise;
    },
  };
}

function buildMontageDeps(
  callLog: CallLog,
  options?: { readonly controllableProbe?: ReturnType<typeof createControllableResponse> },
): RenderApiDependencies {
  const storage = createFakeObjectStorage(callLog, {
    files: [
      { path: `${MONTAGE_PROJECT_ROOT}/raw/aroll/clip01.mp4`, contents: 'clip-bytes', modifiedAtMs: 1_700_000_000_000 },
      { path: `${MONTAGE_PROJECT_ROOT}/work/whisper/aroll/clip01.json`, contents: WHISPER_RAW_OUTPUT },
    ],
  });

  return createFakeRenderApiDependencies(callLog, {
    storage,
    readDirectory: toDirectoryReader(storage),
    statFile: toFileStatReader(storage),
    ensureDirectory: storage.ensureDirectory,
    resolveMontageBinaries: async () => MONTAGE_BINARIES,
    createCommandRunner: async () =>
      createFakeCommandRunner(
        [
          {
            bin: MONTAGE_BINARIES.ffprobe,
            response: options?.controllableProbe?.factory ?? { stdout: VIDEO_PROBE_STDOUT, exitCode: 0 },
          },
          { bin: MONTAGE_BINARIES.ffmpeg, response: { exitCode: 0 } },
          { bin: MONTAGE_BINARIES.whisperCli, response: { exitCode: 0 } },
        ],
        callLog,
      ),
  });
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

    const first = queue.create(createInput(deps, 'acme-launch'));
    const second = queue.create(createInput(deps, 'acme-launch'));

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

      const first = queue.create(createInput(deps, 'acme-launch'));
      const second = queue.create(createInput(deps, 'acme-launch'));

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

    const alphaFirst = queue.create(createInput(deps, 'alpha'));
    queue.create(createInput(deps, 'beta'));
    const alphaSecond = queue.create(createInput(deps, 'alpha'));

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

    const job = queue.create(createInput(deps, 'acme-launch'));
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

    queue.create(createInput(deps, 'acme-launch'));
    const second = queue.create(createInput(deps, 'acme-launch'));
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

    const job = queue.create(createInput(deps, 'acme-launch'));
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

    const job = queue.create(createInput(deps, 'acme-launch'));
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

    const job = queue.create(createInput(deps, 'acme-launch'));
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

      const job = queue.create(createInput(deps, 'acme-launch'));
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

    const job = queue.create(createInput(deps, 'acme-launch'));
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.report?.deliverable.resource).toBe(`out/${job.id}.mp4`);
    expect(finished?.report?.intermediates.mutedVideoResource).toBe(`work/renders/${job.id}/video-muted.mp4`);
    expect(finished?.report?.intermediates.masterAudioResource).toBe(`work/renders/${job.id}/master.wav`);
  });

  it('never invokes a removal port for a finished job', async () => {
    const succeededCallLog = createCallLog();
    const succeededDeps = createFakeRenderApiDependencies(succeededCallLog);
    const succeededQueue = createRenderJobQueue(succeededDeps);
    succeededQueue.create(createInput(succeededDeps, 'acme-launch'));
    await succeededQueue.whenIdle();
    expect(succeededCallLog.ports()).not.toContain('removeTemporary');

    const failedCallLog = createCallLog();
    const failedDeps = createFakeRenderApiDependencies(failedCallLog, {
      muxAudioIntoVideo: async () => {
        throw new Error('mux exploded');
      },
    });
    const failedQueue = createRenderJobQueue(failedDeps);
    failedQueue.create(createInput(failedDeps, 'acme-launch'));
    await failedQueue.whenIdle();
    expect(failedCallLog.ports()).not.toContain('removeTemporary');

    const canceledCallLog = createCallLog();
    const canceledControllable = createControllableRenderMutedVideo();
    const canceledDeps = createFakeRenderApiDependencies(canceledCallLog, {
      renderMutedVideo: canceledControllable.port,
    });
    const canceledQueue = createRenderJobQueue(canceledDeps);
    const canceledJob = canceledQueue.create(createInput(canceledDeps, 'acme-launch'));
    await canceledControllable.started;
    canceledQueue.cancel(canceledJob.id);
    canceledControllable.resolve(DEFAULT_RENDER_OUTPUT);
    await canceledQueue.whenIdle();
    expect(canceledCallLog.ports()).not.toContain('removeTemporary');
  });
});

describe('createRenderJobQueue — montage jobs', () => {
  it('never lets a render and a montage job run at the same time (single FIFO across kinds)', async () => {
    const callLog = createCallLog();
    const renderControllable = createControllableRenderMutedVideo();
    const deps = {
      ...buildMontageDeps(callLog),
      renderMutedVideo: renderControllable.port,
    };
    const queue = createRenderJobQueue(deps);

    const renderJob = queue.create(createInput(deps, 'acme-launch'));
    const montageJob = queue.create(createMontageInput(deps, 'montage-project'));

    expect(renderJob.state).toBe('running');
    expect(montageJob.state).toBe('queued');
    expect(queue.size()).toEqual({ running: 1, queued: 1 });

    renderControllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();

    expect(queue.get(renderJob.id)?.state).toBe('succeeded');
    expect(queue.get(montageJob.id)?.state).toBe('succeeded');
  });

  it('keeps a render job queued while a montage job is running', async () => {
    const callLog = createCallLog();
    const controllableProbe = createControllableResponse();
    const deps = buildMontageDeps(callLog, { controllableProbe });
    const queue = createRenderJobQueue(deps);

    const montageJob = queue.create(createMontageInput(deps, 'montage-project'));
    const renderJob = queue.create(createInput(deps, 'acme-launch'));

    expect(montageJob.state).toBe('running');
    expect(renderJob.state).toBe('queued');

    controllableProbe.respond({ stdout: VIDEO_PROBE_STDOUT, exitCode: 0 });
    await queue.whenIdle();

    expect(queue.get(montageJob.id)?.state).toBe('succeeded');
    expect(queue.get(renderJob.id)?.state).toBe('succeeded');
  });

  it('cancels a queued montage job without invoking a single pipeline port', async () => {
    const callLog = createCallLog();
    const controllableProbe = createControllableResponse();
    const deps = buildMontageDeps(callLog, { controllableProbe });
    const queue = createRenderJobQueue(deps);

    queue.create(createMontageInput(deps, 'montage-project'));
    const second = queue.create(createMontageInput(deps, 'montage-project'));
    expect(second.state).toBe('queued');

    const portsBeforeCancel = callLog.ports();
    const result = queue.cancel(second.id);

    expect(result).toEqual({
      kind: 'canceled',
      job: expect.objectContaining({ id: second.id, state: 'canceled', kind: 'montage' }),
    });
    expect(callLog.ports()).toEqual(portsBeforeCancel);

    controllableProbe.respond({ stdout: VIDEO_PROBE_STDOUT, exitCode: 0 });
    await queue.whenIdle();
  });

  it('moves a running montage job to canceling and settles it as canceled with report null at the plan checkpoint', async () => {
    const callLog = createCallLog();
    const controllableProbe = createControllableResponse();
    const deps = buildMontageDeps(callLog, { controllableProbe });
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createMontageInput(deps, 'montage-project'));
    await controllableProbe.started;
    expect(queue.get(job.id)?.state).toBe('running');

    const result = queue.cancel(job.id);
    expect(result).toEqual({
      kind: 'canceling',
      job: expect.objectContaining({ id: job.id, state: 'canceling', kind: 'montage' }),
    });

    controllableProbe.respond({ stdout: VIDEO_PROBE_STDOUT, exitCode: 0 });
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.state).toBe('canceled');
    expect(finished?.report).toBeNull();
    expect(finished?.error).toBeNull();
    expect(finished?.finishedAt).not.toBeNull();

    const writes = callLog
      .entries()
      .filter((entry) => entry.port === 'writeTextFile')
      .map((entry) => (entry.input as { path: string }).path);
    expect(writes.some((path) => path.endsWith('work/catalog.json'))).toBe(true);
    expect(writes.some((path) => path.endsWith('work/timeline.json'))).toBe(false);
  });

  it('exposes a montage-shaped progress, never a render-shaped one', async () => {
    const callLog = createCallLog();
    const deps = buildMontageDeps(callLog);
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createMontageInput(deps, 'montage-project'));
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.kind).toBe('montage');
    if (finished?.progress) {
      expect(Object.keys(finished.progress).sort()).toEqual(['percent', 'processedAssets', 'stage', 'totalAssets']);
      expect(finished.progress).not.toHaveProperty('renderedFrames');
      expect(finished.progress).not.toHaveProperty('totalFrames');
    }
  });

  it('reports the montage job with its own report shape once succeeded', async () => {
    const callLog = createCallLog();
    const deps = buildMontageDeps(callLog);
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createMontageInput(deps, 'montage-project'));
    await queue.whenIdle();

    const finished = queue.get(job.id);
    expect(finished?.state).toBe('succeeded');
    expect(finished?.report).toEqual({
      catalogPath: 'work/catalog.json',
      timelinePath: 'work/timeline.json',
      editDecisionListPath: 'work/edl.json',
      preset: 'software-demo',
      seed: 0,
      logoAssetId: null,
      scriptAlignment: null,
      voiceSource: 'aroll',
      voiceTrack: null,
      captionStyle: 'bold-impact',
    });
  });
});

describe('createRenderJobQueue — persistence across a restart', () => {
  it('a fresh queue over the same store reads back a job created before the restart', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const queue = createRenderJobQueue(deps);

    const job = queue.create(createInput(deps, 'acme-launch'));
    await queue.whenIdle();

    const restarted = createRenderJobQueue(deps);

    expect(restarted.get(job.id)).toMatchObject({ id: job.id, state: 'succeeded' });
    expect(restarted.listBySlug('acme-launch').map((entry) => entry.id)).toEqual([job.id]);
  });

  it('after a restart, the new queue sees the old job from the store and a new one live in its own map', async () => {
    const callLog = createCallLog();
    let nowMs = 0;
    const deps = createFakeRenderApiDependencies(callLog, {
      clock: { nowIso: () => new Date(nowMs).toISOString() },
    });
    const firstQueue = createRenderJobQueue(deps);

    const oldJob = firstQueue.create(createInput(deps, 'acme-launch'));
    await firstQueue.whenIdle();

    nowMs += 60_000;
    const controllable = createControllableRenderMutedVideo();
    const liveDeps = { ...deps, renderMutedVideo: controllable.port };
    const restartedQueue = createRenderJobQueue(liveDeps);
    const newJob = restartedQueue.create(createInput(liveDeps, 'acme-launch'));

    const listed = restartedQueue.listBySlug('acme-launch');
    expect(listed.map((entry) => entry.id)).toEqual([oldJob.id, newJob.id]);

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await restartedQueue.whenIdle();
  });
});

describe('recoverInterruptedJobs', () => {
  it('marks every queued, running or canceling job as failed with JOB_INTERRUPTED and leaves terminal jobs untouched', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    deps.localStore.projects.insert('acme-launch');

    deps.localStore.jobs.insert({
      id: 'queued-1',
      slug: 'acme-launch',
      kind: 'render',
      state: 'queued',
      params: {},
      createdAt: '2026-09-23T00:00:00.000Z',
    });
    deps.localStore.jobs.insert({
      id: 'running-1',
      slug: 'acme-launch',
      kind: 'render',
      state: 'running',
      params: {},
      createdAt: '2026-09-23T00:00:00.000Z',
    });
    deps.localStore.jobs.insert({
      id: 'canceling-1',
      slug: 'acme-launch',
      kind: 'render',
      state: 'canceling',
      params: {},
      createdAt: '2026-09-23T00:00:00.000Z',
    });
    deps.localStore.jobs.insert({
      id: 'succeeded-1',
      slug: 'acme-launch',
      kind: 'render',
      state: 'succeeded',
      params: {},
      createdAt: '2026-09-23T00:00:00.000Z',
    });

    recoverInterruptedJobs(deps);

    for (const id of ['queued-1', 'running-1', 'canceling-1']) {
      const row = deps.localStore.jobs.get(id);
      expect(row?.state).toBe('failed');
      expect(row?.error).toMatchObject({ code: 'JOB_INTERRUPTED' });
      expect(row?.finishedAt).not.toBeNull();
    }

    const untouched = deps.localStore.jobs.get('succeeded-1');
    expect(untouched?.state).toBe('succeeded');
    expect(untouched?.error).toBeNull();
  });

  it('does nothing when there is nothing unfinished', () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    expect(() => recoverInterruptedJobs(deps)).not.toThrow();
  });
});

describe('createRenderJobQueue — progress throttling', () => {
  it('throttles progress writes to the store to at most one per second, and always flushes the last one on settle', async () => {
    const callLog = createCallLog();
    let nowMs = 0;
    const deps = createFakeRenderApiDependencies(callLog, {
      clock: { nowIso: () => new Date(nowMs).toISOString() },
    });
    const controllable = createControllableRenderMutedVideo();
    const throttledDeps = { ...deps, renderMutedVideo: controllable.port };
    const queue = createRenderJobQueue(throttledDeps);

    const job = queue.create(createInput(throttledDeps, 'acme-launch'));
    await controllable.started;

    controllable.emitProgress(10, 100);
    nowMs += 100;
    controllable.emitProgress(20, 100);

    const midway = deps.localStore.jobs.get(job.id)?.progress as { renderedFrames: number | null } | null;
    expect(midway?.renderedFrames).not.toBe(20);

    nowMs += 5_000;
    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await queue.whenIdle();

    const settled = deps.localStore.jobs.get(job.id);
    const live = queue.get(job.id);
    expect(settled?.state).toBe('succeeded');
    expect(settled?.progress).toEqual(live?.progress);
  });
});
