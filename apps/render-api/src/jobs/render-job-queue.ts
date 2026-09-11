import { resolveMediaProject } from '@video-maker/auto-montage';
import type { LogoMode, MontagePresetName } from '@video-maker/auto-montage';
import type { Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import { toErrorPayload } from '../errors/to-error-payload';
import { mergeMontageJobProgress, startMontageJobStage } from './montage-job-progress';
import { startStoryboardJobStage } from './storyboard-job-progress';
import { isStoryboardPipelineCanceled } from './storyboard-pipeline-observer';
import type { StoryboardPipelineObserver } from './storyboard-pipeline-observer';
import { runStoryboardPipeline } from './run-storyboard-pipeline';
import { runVoicePipeline } from './run-voice-pipeline';
import { mergeVoiceJobProgress, startVoiceJobStage } from './voice-job-progress';
import { isVoicePipelineCanceled } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';
import { isMontagePipelineCanceled } from './montage-pipeline-observer';
import type { MontagePipelineObserver } from './montage-pipeline-observer';
import type { RenderPipelineObserver } from '../pipeline/render-pipeline-observer';
import { isRenderPipelineCanceled } from '../pipeline/render-pipeline-observer';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import { runRenderPipeline } from '../pipeline/run-render-pipeline';
import { mergeRenderProgress, startRenderJobStage } from './render-job-progress';
import { applyRenderJobEvent } from './render-job-state';
import type {
  CreateJobInput,
  Job,
  MontageJobProgress,
  MontageJobReport,
  RenderJobProgress,
  RenderJobState,
  StoryboardJobProgress,
  StoryboardJobReport,
  VoiceJobProgress,
  VoiceJobReport,
} from './render-job';
import { toJob } from './render-job';
import { runMontagePipeline } from './run-montage-pipeline';

export type CancelRenderJobResult =
  | { readonly kind: 'canceled'; readonly job: Job }
  | { readonly kind: 'canceling'; readonly job: Job }
  | { readonly kind: 'not-cancelable'; readonly job: Job }
  | { readonly kind: 'not-found' };

export interface RenderJobQueueSize {
  readonly running: number;
  readonly queued: number;
}

export interface RenderJobQueue {
  readonly create: (input: CreateJobInput) => Job;
  readonly get: (jobId: string) => Job | null;
  readonly listBySlug: (slug: string) => readonly Job[];
  readonly cancel: (jobId: string) => CancelRenderJobResult;
  readonly size: () => RenderJobQueueSize;
  readonly whenIdle: () => Promise<void>;
}

interface JobRecordBase {
  readonly id: string;
  readonly slug: string;
  readonly projectRoot: string;
  readonly createdAt: string;
  state: RenderJobState;
  startedAt: string | null;
  finishedAt: string | null;
  error: RenderApiErrorPayload | null;
}

interface RenderJobRecord extends JobRecordBase {
  readonly kind: 'render';
  readonly timeline: Timeline;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
}

interface MontageJobRecord extends JobRecordBase {
  readonly kind: 'montage';
  readonly preset: MontagePresetName;
  readonly seed: number;
  readonly scriptPath: string | null;
  readonly scriptText: string | null;
  readonly logo: LogoMode;
  progress: MontageJobProgress | null;
  report: MontageJobReport | null;
}

interface StoryboardJobRecord extends JobRecordBase {
  readonly kind: 'storyboard';
  readonly brief: string | null;
  readonly scriptText: string | null;
  readonly model: string | null;
  progress: StoryboardJobProgress | null;
  report: StoryboardJobReport | null;
}

interface VoiceJobRecord extends JobRecordBase {
  readonly kind: 'voice';
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
  progress: VoiceJobProgress | null;
  report: VoiceJobReport | null;
}

type JobRecord = RenderJobRecord | MontageJobRecord | StoryboardJobRecord | VoiceJobRecord;

export function createRenderJobQueue(deps: RenderApiDependencies): RenderJobQueue {
  const records = new Map<string, JobRecord>();
  const pending: string[] = [];
  const idleResolvers: Array<() => void> = [];
  let activeId: string | null = null;

  function logTransition(record: JobRecord, from: RenderJobState, to: RenderJobState): void {
    deps.logger.info({
      event: 'render-job-transition',
      detail: { jobId: record.id, slug: record.slug, from, to },
    });
  }

  function resolveIdle(): void {
    const resolvers = idleResolvers.splice(0, idleResolvers.length);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  function settle<T extends JobRecord>(record: T, report: T['report'], failure: RenderApiErrorPayload | null): void {
    const from = record.state;
    const transition = applyRenderJobEvent(from, { kind: 'settle', failed: failure !== null });

    if (transition.kind === 'rejected') {
      return;
    }

    record.state = transition.state;
    record.report = transition.state === 'succeeded' ? report : null;
    record.error = transition.state === 'failed' ? failure : null;
    record.finishedAt = deps.clock.nowIso();
    logTransition(record, from, record.state);
  }

  async function runRenderJob(record: RenderJobRecord): Promise<void> {
    const observer: RenderPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startRenderJobStage(record.progress, stage);
      },
      renderProgressed: (renderedFrames, totalFrames) => {
        record.progress = mergeRenderProgress(record.progress, renderedFrames, totalFrames);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: RenderPipelineReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runRenderPipeline(
        { renderId: record.id, projectRoot: record.projectRoot, timeline: record.timeline },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isRenderPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runMontageJob(record: MontageJobRecord): Promise<void> {
    const observer: MontagePipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startMontageJobStage(record.progress, stage);
      },
      assetProcessed: (stage, totalAssets) => {
        record.progress = mergeMontageJobProgress(record.progress, stage, totalAssets);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: MontageJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runMontagePipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          preset: record.preset,
          seed: record.seed,
          scriptPath: record.scriptPath,
          scriptText: record.scriptText,
          logo: record.logo,
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isMontagePipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runStoryboardJob(record: StoryboardJobRecord): Promise<void> {
    const observer: StoryboardPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startStoryboardJobStage(record.progress, stage);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: StoryboardJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runStoryboardPipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          storyboardId: record.id,
          brief: record.brief,
          scriptText: record.scriptText,
          model: record.model,
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isStoryboardPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runVoiceJob(record: VoiceJobRecord): Promise<void> {
    const observer: VoicePipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startVoiceJobStage(record.progress, stage);
      },
      sceneProcessed: (stage, processedScenes, totalScenes) => {
        record.progress = mergeVoiceJobProgress(record.progress, stage, processedScenes, totalScenes);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: VoiceJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runVoicePipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          voiceId: record.voiceId,
          sceneIds: record.sceneIds,
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isVoicePipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runJob(record: JobRecord): Promise<void> {
    switch (record.kind) {
      case 'render':
        await runRenderJob(record);
        break;
      case 'montage':
        await runMontageJob(record);
        break;
      case 'storyboard':
        await runStoryboardJob(record);
        break;
      case 'voice':
        await runVoiceJob(record);
        break;
    }

    activeId = null;
    dispatchNext();
  }

  function dispatchNext(): void {
    if (activeId !== null) {
      return;
    }

    let nextId = pending.shift();
    while (nextId !== undefined) {
      const record = records.get(nextId);
      if (record === undefined) {
        nextId = pending.shift();
        continue;
      }

      const transition = applyRenderJobEvent(record.state, { kind: 'dispatch' });
      if (transition.kind === 'rejected') {
        nextId = pending.shift();
        continue;
      }

      const previousState = record.state;
      record.state = transition.state;
      record.startedAt = deps.clock.nowIso();
      activeId = record.id;
      logTransition(record, previousState, record.state);
      void runJob(record);
      return;
    }

    resolveIdle();
  }

  function createJobRecord(base: Omit<JobRecordBase, never>, input: CreateJobInput): JobRecord {
    switch (input.kind) {
      case 'render':
        return { ...base, kind: 'render', timeline: input.timeline, progress: null, report: null };
      case 'montage':
        return {
          ...base,
          kind: 'montage',
          preset: input.preset,
          seed: input.seed,
          scriptPath: input.scriptPath,
          scriptText: input.scriptText,
          logo: input.logo,
          progress: null,
          report: null,
        };
      case 'storyboard':
        return {
          ...base,
          kind: 'storyboard',
          brief: input.brief,
          scriptText: input.scriptText,
          model: input.model,
          progress: null,
          report: null,
        };
      case 'voice':
        return {
          ...base,
          kind: 'voice',
          voiceId: input.voiceId,
          sceneIds: input.sceneIds,
          progress: null,
          report: null,
        };
    }
  }

  function create(input: CreateJobInput): Job {
    const id = deps.randomId();
    const base = {
      id,
      slug: input.slug,
      projectRoot: input.projectRoot,
      createdAt: deps.clock.nowIso(),
      state: 'queued' as const,
      startedAt: null,
      finishedAt: null,
      error: null,
    };

    const record = createJobRecord(base, input);

    records.set(id, record);
    pending.push(id);
    dispatchNext();

    return toJob(record);
  }

  function get(jobId: string): Job | null {
    const record = records.get(jobId);
    return record === undefined ? null : toJob(record);
  }

  function listBySlug(slug: string): readonly Job[] {
    const jobs: Job[] = [];
    for (const record of records.values()) {
      if (record.slug === slug) {
        jobs.push(toJob(record));
      }
    }
    return jobs;
  }

  function cancel(jobId: string): CancelRenderJobResult {
    const record = records.get(jobId);
    if (record === undefined) {
      return { kind: 'not-found' };
    }

    const previousState = record.state;
    const transition = applyRenderJobEvent(previousState, { kind: 'cancel' });

    if (transition.kind === 'rejected') {
      return { kind: 'not-cancelable', job: toJob(record) };
    }

    if (previousState === transition.state) {
      return { kind: 'canceling', job: toJob(record) };
    }

    record.state = transition.state;

    if (previousState === 'queued') {
      const index = pending.indexOf(jobId);
      if (index !== -1) {
        pending.splice(index, 1);
      }
      record.finishedAt = deps.clock.nowIso();
    }

    logTransition(record, previousState, record.state);

    return {
      kind: transition.state === 'canceled' ? 'canceled' : 'canceling',
      job: toJob(record),
    };
  }

  function size(): RenderJobQueueSize {
    return { running: activeId === null ? 0 : 1, queued: pending.length };
  }

  function whenIdle(): Promise<void> {
    if (activeId === null && pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      idleResolvers.push(resolve);
    });
  }

  return { create, get, listBySlug, cancel, size, whenIdle };
}
