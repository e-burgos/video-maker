import { resolveMediaProject } from '@video-maker/auto-montage';
import type { LogoMode, MontagePresetName, VoiceSource } from '@video-maker/auto-montage';
import type { CaptionStyle, MusicMode, OutputPreset, Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import { toErrorPayload } from '../errors/to-error-payload';
import { mergeMontageJobProgress, startMontageJobStage } from './montage-job-progress';
import { startStoryboardJobStage } from './storyboard-job-progress';
import { isStoryboardPipelineCanceled } from './storyboard-pipeline-observer';
import type { StoryboardPipelineObserver } from './storyboard-pipeline-observer';
import { runStoryboardPipeline } from './run-storyboard-pipeline';
import { completeMotionJobProgress, mergeMotionVoiceProgress, startMotionJobStage } from './motion-job-progress';
import { isMotionPipelineCanceled } from './motion-pipeline-observer';
import type { MotionPipelineObserver } from './motion-pipeline-observer';
import { runMotionPipeline } from './run-motion-pipeline';
import type { ProjectBrandResolver } from '../brands/project-brand-resolver';
import { runVoicePipeline } from './run-voice-pipeline';
import { mergeVoiceJobProgress, startVoiceJobStage } from './voice-job-progress';
import { isVoicePipelineCanceled } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';
import { isMontagePipelineCanceled } from './montage-pipeline-observer';
import type { MontagePipelineObserver } from './montage-pipeline-observer';
import { mergePhotoArollJobProgress, startPhotoArollJobStage } from './photo-aroll-job-progress';
import { isPhotoArollPipelineCanceled } from './photo-aroll-pipeline-observer';
import type { PhotoArollPipelineObserver } from './photo-aroll-pipeline-observer';
import { runPhotoArollPipeline } from './run-photo-aroll-pipeline';
import type { RenderPipelineObserver } from '../pipeline/render-pipeline-observer';
import { isRenderPipelineCanceled } from '../pipeline/render-pipeline-observer';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import { runRenderPipeline } from '../pipeline/run-render-pipeline';
import { mergeRenderProgress, startRenderJobStage } from './render-job-progress';
import { applyRenderJobEvent } from './render-job-state';
import { parseStoredJob, toStoredParams } from './job-persistence';
import { toJob } from './render-job';
import type {
  CreateJobInput,
  Job,
  MontageJobProgress,
  MontageJobReport,
  MotionJobProgress,
  MotionJobReport,
  MotionPhase,
  PhotoArollJobProgress,
  PhotoArollJobReport,
  PublishJobProgress,
  PublishJobReport,
  PublishPlatform,
  PublishPrivacy,
  RenderJobProgress,
  RenderJobState,
  ReferenceJobProgress,
  ReferenceJobReport,
  ReviewJobProgress,
  ReviewJobReport,
  SampleSpec,
  StoryboardJobProgress,
  StoryboardJobReport,
  VoiceJobProgress,
  VoiceJobReport,
} from './render-job';
import { completeReferenceJobProgress, startReferenceJobStage } from './reference-job-progress';
import { isReferencePipelineCanceled } from './reference-pipeline-observer';
import type { ReferencePipelineObserver } from './reference-pipeline-observer';
import { completeReviewJobProgress, startReviewJobStage } from './review-job-progress';
import { isReviewPipelineCanceled } from './review-pipeline-observer';
import type { ReviewPipelineObserver } from './review-pipeline-observer';
import { runReferencePipeline } from './run-reference-pipeline';
import type { ReferencePipelineOptions } from './run-reference-pipeline';
import { runReviewPipeline } from './run-review-pipeline';
import type { ReviewPipelineOptions } from './run-review-pipeline';
import { runMontagePipeline } from './run-montage-pipeline';
import { completePublishJobProgress, mergePublishUploadProgress, startPublishJobStage } from './publish-job-progress';
import { isPublishPipelineCanceled } from './publish-pipeline-observer';
import type { PublishPipelineObserver } from './publish-pipeline-observer';
import { runPublishPipeline } from './run-publish-pipeline';
import type { PublishPipelineOptions } from './run-publish-pipeline';
import { createYoutubeServices } from '../youtube/youtube-services';
import type { YoutubeClient } from '../youtube/youtube-client';

const PROGRESS_PERSIST_THROTTLE_MS = 1_000;
const JOB_INTERRUPTED_MESSAGE = 'The service restarted while this job was still in progress.';

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
  readonly createRetry: (originalId: string, input: CreateJobInput) => Job;
  readonly get: (jobId: string) => Job | null;
  readonly listBySlug: (slug: string) => readonly Job[];
  readonly cancel: (jobId: string) => CancelRenderJobResult;
  readonly size: () => RenderJobQueueSize;
  readonly whenIdle: () => Promise<void>;
}

export function recoverInterruptedJobs(deps: RenderApiDependencies): void {
  const unfinished = deps.localStore.jobs.listUnfinished();
  if (unfinished.length === 0) {
    return;
  }

  deps.localStore.publications.failUploadingForJobs(unfinished.map((job) => job.id));

  const errorPayload: RenderApiErrorPayload = {
    code: 'JOB_INTERRUPTED',
    stage: null,
    message: JOB_INTERRUPTED_MESSAGE,
  };
  const finishedAt = deps.clock.nowIso();

  deps.localStore.jobs.markInterrupted(
    unfinished.map((job) => job.id),
    errorPayload,
    finishedAt,
  );
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
  readonly sample?: SampleSpec;
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
  readonly format: OutputPreset;
  readonly voice: VoiceSource;
  readonly captionStyle: CaptionStyle | null;
  readonly musicMode?: MusicMode;
  readonly musicFloorDb?: number;
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
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
  progress: VoiceJobProgress | null;
  report: VoiceJobReport | null;
}

interface PhotoArollJobRecord extends JobRecordBase {
  readonly kind: 'photo-aroll';
  readonly photos: readonly string[];
  readonly output: string;
  readonly fps: number;
  progress: PhotoArollJobProgress | null;
  report: PhotoArollJobReport | null;
}

interface MotionJobRecord extends JobRecordBase {
  readonly kind: 'motion';
  readonly phase: MotionPhase;
  readonly output: string;
  readonly takes: number;
  readonly sample?: SampleSpec;
  progress: MotionJobProgress | null;
  report: MotionJobReport | null;
}

interface PublishJobRecord extends JobRecordBase {
  readonly kind: 'publish';
  readonly retryOf: string | null;
  readonly platform: PublishPlatform;
  readonly file: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly privacy: PublishPrivacy;
  readonly publishAt: string | null;
  readonly playlistIds: readonly string[];
  readonly thumbnail: string | null;
  readonly categoryId: string;
  readonly madeForKids: boolean;
  readonly defaultLanguage: string;
  readonly ignoreReview: boolean;
  progress: PublishJobProgress | null;
  report: PublishJobReport | null;
}

interface ReviewJobRecord extends JobRecordBase {
  readonly kind: 'review';
  readonly file: string;
  progress: ReviewJobProgress | null;
  report: ReviewJobReport | null;
}

interface ReferenceJobRecord extends JobRecordBase {
  readonly kind: 'reference';
  readonly file: string;
  progress: ReferenceJobProgress | null;
  report: ReferenceJobReport | null;
}

type JobRecord =
  | RenderJobRecord
  | MontageJobRecord
  | StoryboardJobRecord
  | VoiceJobRecord
  | PhotoArollJobRecord
  | MotionJobRecord
  | PublishJobRecord
  | ReviewJobRecord
  | ReferenceJobRecord;

export function createRenderJobQueue(
  deps: RenderApiDependencies,
  resolveProjectBrand: ProjectBrandResolver = async () => null,
  youtube: YoutubeClient = createYoutubeServices(deps).client,
  publishOptions: Omit<PublishPipelineOptions, 'youtube'> = {},
  reviewOptions: ReviewPipelineOptions = {},
  referenceOptions: ReferencePipelineOptions = {},
): RenderJobQueue {
  const jobsStore = deps.localStore.jobs;
  const records = new Map<string, JobRecord>();
  const pending: string[] = [];
  const idleResolvers: Array<() => void> = [];
  const lastProgressPersistMs = new Map<string, number>();
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

  function persistProgress(record: JobRecord, force: boolean): void {
    const nowMs = Date.parse(deps.clock.nowIso());
    const lastMs = lastProgressPersistMs.get(record.id) ?? -Infinity;
    if (!force && nowMs - lastMs < PROGRESS_PERSIST_THROTTLE_MS) {
      return;
    }
    lastProgressPersistMs.set(record.id, nowMs);
    jobsStore.updateProgress(record.id, record.progress);
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

    persistProgress(record, true);
    lastProgressPersistMs.delete(record.id);
    jobsStore.setReport(record.id, record.report);
    jobsStore.updateState(record.id, record.state, undefined, record.finishedAt, record.error);
  }

  async function runRenderJob(record: RenderJobRecord): Promise<void> {
    const observer: RenderPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startRenderJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      renderProgressed: (renderedFrames, totalFrames) => {
        record.progress = mergeRenderProgress(record.progress, renderedFrames, totalFrames);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: RenderPipelineReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runRenderPipeline(
        {
          renderId: record.id,
          projectRoot: record.projectRoot,
          timeline: record.timeline,
          ...(record.sample === undefined ? {} : { sampleSeconds: record.sample.seconds }),
        },
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
        persistProgress(record, false);
      },
      assetProcessed: (stage, totalAssets) => {
        record.progress = mergeMontageJobProgress(record.progress, stage, totalAssets);
        persistProgress(record, false);
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
          format: record.format,
          voice: record.voice,
          captionStyle: record.captionStyle,
          ...(record.musicMode === undefined ? {} : { musicMode: record.musicMode }),
          ...(record.musicFloorDb === undefined ? {} : { musicFloorDb: record.musicFloorDb }),
          brand: await resolveProjectBrand(record.slug),
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
        persistProgress(record, false);
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
        persistProgress(record, false);
      },
      sceneProcessed: (stage, processedScenes, totalScenes) => {
        record.progress = mergeVoiceJobProgress(record.progress, stage, processedScenes, totalScenes);
        persistProgress(record, false);
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
          scriptText: record.scriptText,
          scriptPath: record.scriptPath,
          gapMs: record.gapMs,
          brandVoice: record.voiceId === null ? ((await resolveProjectBrand(record.slug))?.voice ?? null) : null,
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isVoicePipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runPhotoArollJob(record: PhotoArollJobRecord): Promise<void> {
    const observer: PhotoArollPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startPhotoArollJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      clipProcessed: (totalClips) => {
        record.progress = mergePhotoArollJobProgress(record.progress, totalClips);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: PhotoArollJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runPhotoArollPipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          photos: record.photos,
          output: record.output,
          fps: record.fps,
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isPhotoArollPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
  }

  async function runMotionJob(record: MotionJobRecord): Promise<void> {
    const observer: MotionPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startMotionJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      lineVoiced: (linesVoiced, totalLines) => {
        record.progress = mergeMotionVoiceProgress(record.progress, linesVoiced, totalLines);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: MotionJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runMotionPipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          phase: record.phase,
          output: record.output,
          takes: record.takes,
          ...(record.sample === undefined ? {} : { sampleSeconds: record.sample.seconds }),
        },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isMotionPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    if (report !== null) {
      record.progress = completeMotionJobProgress(record.progress);
    }
    settle(record, report, failure);
  }

  async function runPublishJob(record: PublishJobRecord): Promise<void> {
    const observer: PublishPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startPublishJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      bytesUploaded: (uploadedBytes, totalBytes) => {
        record.progress = mergePublishUploadProgress(record.progress, uploadedBytes, totalBytes);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: PublishJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runPublishPipeline(
        {
          jobId: record.id,
          slug: record.slug,
          project: resolveMediaProject(record.projectRoot),
          resume: record.retryOf !== null,
          platform: record.platform,
          file: record.file,
          title: record.title,
          description: record.description,
          tags: record.tags,
          privacy: record.privacy,
          publishAt: record.publishAt,
          playlistIds: record.playlistIds,
          thumbnail: record.thumbnail,
          categoryId: record.categoryId,
          madeForKids: record.madeForKids,
          defaultLanguage: record.defaultLanguage,
        },
        deps,
        observer,
        { ...publishOptions, youtube },
      );
    } catch (cause) {
      failure = isPublishPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    if (report !== null) {
      record.progress = completePublishJobProgress(record.progress);
    }
    settle(record, report, failure);
  }

  async function runReviewJob(record: ReviewJobRecord): Promise<void> {
    const observer: ReviewPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startReviewJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: ReviewJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runReviewPipeline(
        {
          project: resolveMediaProject(record.projectRoot),
          file: record.file,
          mode: deps.localStore.projects.get(record.slug)?.mode === 'motion' ? 'motion' : 'footage',
        },
        deps,
        observer,
        reviewOptions,
      );
    } catch (cause) {
      failure = isReviewPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    if (report !== null) {
      record.progress = completeReviewJobProgress(record.progress);
    }
    settle(record, report, failure);
  }

  async function runReferenceJob(record: ReferenceJobRecord): Promise<void> {
    const observer: ReferencePipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startReferenceJobStage(record.progress, stage);
        persistProgress(record, false);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: ReferenceJobReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runReferencePipeline(
        { project: resolveMediaProject(record.projectRoot), file: record.file },
        deps,
        observer,
        referenceOptions,
      );
    } catch (cause) {
      failure = isReferencePipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    if (report !== null) {
      record.progress = completeReferenceJobProgress(record.progress);
    }
    settle(record, report, failure);
  }

  function reviewableFile(record: JobRecord): string | null {
    if (record.state !== 'succeeded') {
      return null;
    }
    if (record.kind === 'render') {
      return record.report?.sample === true ? null : (record.report?.deliverable.resource ?? null);
    }
    if (record.kind === 'motion') {
      return record.report?.sample === true ? null : (record.report?.path ?? null);
    }
    return null;
  }

  function enqueueReviewFor(record: JobRecord): void {
    const file = reviewableFile(record);
    if (file === null) {
      return;
    }
    try {
      registerJob({ kind: 'review', slug: record.slug, projectRoot: record.projectRoot, file }, null);
    } catch (cause) {
      deps.logger.error({
        event: 'review-job-enqueue-failed',
        detail: { level: 'warning', jobId: record.id, slug: record.slug, file, reason: cause instanceof Error ? cause.message : String(cause) },
      });
    }
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
      case 'photo-aroll':
        await runPhotoArollJob(record);
        break;
      case 'motion':
        await runMotionJob(record);
        break;
      case 'publish':
        await runPublishJob(record);
        break;
      case 'review':
        await runReviewJob(record);
        break;
      case 'reference':
        await runReferenceJob(record);
        break;
    }

    enqueueReviewFor(record);
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
      jobsStore.updateState(record.id, record.state, record.startedAt);
      void runJob(record);
      return;
    }

    resolveIdle();
  }

  function createJobRecord(
    base: Omit<JobRecordBase, never>,
    input: CreateJobInput,
    retryOf: string | null,
  ): JobRecord {
    switch (input.kind) {
      case 'render':
        return {
          ...base,
          kind: 'render',
          timeline: input.timeline,
          ...(input.sample === undefined ? {} : { sample: input.sample }),
          progress: null,
          report: null,
        };
      case 'montage':
        return {
          ...base,
          kind: 'montage',
          preset: input.preset,
          seed: input.seed,
          scriptPath: input.scriptPath,
          scriptText: input.scriptText,
          logo: input.logo,
          format: input.format,
          voice: input.voice,
          captionStyle: input.captionStyle,
          ...(input.musicMode === undefined ? {} : { musicMode: input.musicMode }),
          ...(input.musicFloorDb === undefined ? {} : { musicFloorDb: input.musicFloorDb }),
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
          scriptText: input.scriptText,
          scriptPath: input.scriptPath,
          gapMs: input.gapMs,
          progress: null,
          report: null,
        };
      case 'photo-aroll':
        return {
          ...base,
          kind: 'photo-aroll',
          photos: input.photos,
          output: input.output,
          fps: input.fps,
          progress: null,
          report: null,
        };
      case 'motion':
        return {
          ...base,
          kind: 'motion',
          phase: input.phase,
          output: input.output,
          takes: input.takes,
          ...(input.sample === undefined ? {} : { sample: input.sample }),
          progress: null,
          report: null,
        };
      case 'publish':
        return {
          ...base,
          kind: 'publish',
          retryOf,
          platform: input.platform,
          file: input.file,
          title: input.title,
          description: input.description,
          tags: input.tags,
          privacy: input.privacy,
          publishAt: input.publishAt,
          playlistIds: input.playlistIds,
          thumbnail: input.thumbnail,
          categoryId: input.categoryId,
          madeForKids: input.madeForKids,
          defaultLanguage: input.defaultLanguage,
          ignoreReview: input.ignoreReview,
          progress: null,
          report: null,
        };
      case 'review':
        return { ...base, kind: 'review', file: input.file, progress: null, report: null };
      case 'reference':
        return { ...base, kind: 'reference', file: input.file, progress: null, report: null };
    }
  }

  function registerJob(input: CreateJobInput, retryOf: string | null): Job {
    const id = deps.randomId();
    const createdAt = deps.clock.nowIso();
    const base = {
      id,
      slug: input.slug,
      projectRoot: input.projectRoot,
      createdAt,
      state: 'queued' as const,
      startedAt: null,
      finishedAt: null,
      error: null,
    };

    const record = createJobRecord(base, input, retryOf);

    jobsStore.insert({
      id,
      slug: input.slug,
      kind: input.kind,
      state: 'queued',
      params: toStoredParams(input),
      createdAt,
      retryOf,
    });

    records.set(id, record);
    pending.push(id);

    dispatchNext();

    return toJob(record);
  }

  function create(input: CreateJobInput): Job {
    return registerJob(input, null);
  }

  function createRetry(originalId: string, input: CreateJobInput): Job {
    return registerJob(input, originalId);
  }

  function get(jobId: string): Job | null {
    const record = records.get(jobId);
    if (record !== undefined) {
      return toJob(record);
    }
    const stored = jobsStore.get(jobId);
    return stored === null ? null : parseStoredJob(stored);
  }

  function listBySlug(slug: string): readonly Job[] {
    const liveIds = new Set<string>();
    const jobs: Job[] = [];
    for (const record of records.values()) {
      if (record.slug === slug) {
        jobs.push(toJob(record));
        liveIds.add(record.id);
      }
    }

    for (const row of jobsStore.listByProject(slug)) {
      if (!liveIds.has(row.id)) {
        jobs.push(parseStoredJob(row));
      }
    }

    return jobs.sort((left, right) => (left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : 0));
  }

  function cancel(jobId: string): CancelRenderJobResult {
    const record = records.get(jobId);
    if (record === undefined) {
      const stored = jobsStore.get(jobId);
      return stored === null ? { kind: 'not-found' } : { kind: 'not-cancelable', job: parseStoredJob(stored) };
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
    jobsStore.updateState(record.id, record.state, undefined, record.finishedAt, record.error);

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

  return { create, createRetry, get, listBySlug, cancel, size, whenIdle };
}
