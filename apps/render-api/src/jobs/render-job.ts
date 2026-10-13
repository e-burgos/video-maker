import type { LogoMode, MontagePresetName, VoiceSource } from '@video-maker/auto-montage';
import type {
  CaptionStyle,
  MusicMode,
  ReviewStatus,
  OutputPreset,
  StoryboardSource,
  Timeline,
  VoiceTrackSource,
} from '@video-maker/timeline-core';

import type { RenderApiErrorCode, RenderApiErrorPayload, RenderPipelineStage } from '../errors/render-api-error';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';

export const RENDER_JOB_STATES = [
  'queued',
  'running',
  'canceling',
  'succeeded',
  'failed',
  'canceled',
] as const;

export type RenderJobState = (typeof RENDER_JOB_STATES)[number];

export const TERMINAL_RENDER_JOB_STATES = ['succeeded', 'failed', 'canceled'] as const;

export function isTerminalRenderJobState(state: RenderJobState): boolean {
  return TERMINAL_RENDER_JOB_STATES.some((terminal) => terminal === state);
}

export type JobKind = 'render' | 'montage' | 'storyboard' | 'voice' | 'photo-aroll' | 'motion' | 'publish' | 'review' | 'reference';

export const MONTAGE_STAGES = ['discover', 'probe', 'transcribe', 'plan'] as const;
export type MontageStage = (typeof MONTAGE_STAGES)[number];

export const STORYBOARD_STAGES = ['collect', 'propose', 'persist'] as const;
export type StoryboardStage = (typeof STORYBOARD_STAGES)[number];

export const VOICE_STAGES = ['synthesize', 'transcribe', 'persist'] as const;
export type VoiceStage = (typeof VOICE_STAGES)[number];

export const PHOTO_AROLL_STAGES = ['clips', 'concat', 'mux'] as const;
export type PhotoArollStage = (typeof PHOTO_AROLL_STAGES)[number];

export const MOTION_STAGES = ['storyboard', 'voice', 'plan', 'compose', 'render'] as const;
export type MotionStage = (typeof MOTION_STAGES)[number];

export const PUBLISH_STAGES = ['prepare', 'upload', 'thumbnail', 'playlist'] as const;
export type PublishStage = (typeof PUBLISH_STAGES)[number];

export const REVIEW_STAGES = ['collect', 'measure', 'rules', 'write'] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export const REFERENCE_STAGES = ['probe', 'scenes', 'transcribe', 'keyframes', 'persist'] as const;
export type ReferenceStage = (typeof REFERENCE_STAGES)[number];

export const PUBLISH_PLATFORMS = ['youtube'] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export const PUBLISH_PRIVACIES = ['public', 'unlisted', 'private'] as const;
export type PublishPrivacy = (typeof PUBLISH_PRIVACIES)[number];

export const MOTION_PHASES = ['storyboard', 'video', 'all'] as const;
export type MotionPhase = (typeof MOTION_PHASES)[number];

export interface MotionJobProgress {
  readonly stage: MotionStage;
  readonly linesVoiced: number | null;
  readonly totalLines: number | null;
  readonly percent: number | null;
}

export interface MotionJobStoryboardReport {
  readonly repaired: boolean;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsd: number | null;
}

export interface SampleSpec {
  readonly seconds: number;
}

export interface MotionJobReport {
  readonly path: string | null;
  readonly durationSec: number | null;
  readonly scenes: number;
  readonly musicCredit: string | null;
  readonly storyboard: MotionJobStoryboardReport | null;
  readonly sample?: true;
}

export interface PublishJobProgress {
  readonly stage: PublishStage;
  readonly uploadedBytes: number | null;
  readonly totalBytes: number | null;
  readonly percent: number | null;
}

export interface PublishJobReport {
  readonly videoId: string;
  readonly url: string;
  readonly privacy: PublishPrivacy;
  readonly publishAt: string | null;
  readonly title: string;
}

export interface ReviewJobProgress {
  readonly stage: ReviewStage;
  readonly percent: number | null;
}

export interface ReviewJobCounts {
  readonly critical: number;
  readonly suggestion: number;
  readonly nitpick: number;
}

export interface ReviewJobReport {
  readonly file: string;
  readonly reviewFile: string;
  readonly status: ReviewStatus;
  readonly counts: ReviewJobCounts;
}

export interface ReferenceJobProgress {
  readonly stage: ReferenceStage;
  readonly percent: number | null;
}

export interface ReferenceJobReport {
  readonly file: string;
  readonly name: string;
  readonly briefFile: string;
  readonly durationSec: number;
  readonly scenes: number;
  readonly cutsPerMinute: number;
  readonly hasVoice: boolean;
}

export interface RenderJobProgress {
  readonly stage: RenderPipelineStage;
  readonly renderedFrames: number | null;
  readonly totalFrames: number | null;
  readonly percent: number | null;
}

export interface MontageJobProgress {
  readonly stage: MontageStage;
  readonly processedAssets: number | null;
  readonly totalAssets: number | null;
  readonly percent: number | null;
}

export interface StoryboardJobProgress {
  readonly stage: StoryboardStage;
  readonly percent: number | null;
}

export interface VoiceJobProgress {
  readonly stage: VoiceStage;
  readonly processedScenes: number | null;
  readonly totalScenes: number | null;
  readonly percent: number | null;
}

export interface PhotoArollJobProgress {
  readonly stage: PhotoArollStage;
  readonly processedClips: number | null;
  readonly totalClips: number | null;
  readonly percent: number | null;
}

export interface PhotoArollJobReport {
  readonly path: string;
  readonly clips: number;
  readonly frames: number;
  readonly durationMs: number;
}

export interface VoiceJobSceneReport {
  readonly sceneId: string;
  readonly path: string;
  readonly wordsPath: string;
  readonly durationMs: number;
  readonly source: VoiceTrackSource;
}

export const VOICE_JOB_SOURCES = ['storyboard', 'script'] as const;

export type VoiceJobSource = (typeof VOICE_JOB_SOURCES)[number];

export interface VoiceJobTrackReport {
  readonly path: string;
  readonly wordsPath: string;
  readonly durationMs: number;
  readonly lineCount: number;
  readonly gapMs: number;
}

export interface VoiceJobReport {
  readonly source: VoiceJobSource;
  readonly manifestPath: string;
  readonly storyboardId: string | null;
  readonly voiceId: string;
  readonly language: string;
  readonly scenes: readonly VoiceJobSceneReport[];
  readonly track: VoiceJobTrackReport | null;
}

export interface StoryboardJobUsage {
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsd: number | null;
  readonly model: string | null;
}

export interface StoryboardJobReport {
  readonly storyboardPath: string;
  readonly storyboardId: string;
  readonly source: StoryboardSource;
  readonly language: string;
  readonly sceneCount: number;
  readonly usage: StoryboardJobUsage;
  readonly repaired: boolean;
}

export interface MontageScriptAlignmentReport {
  readonly replaced: number;
  readonly removed: number;
  readonly inserted: number;
  readonly dropped: number;
  readonly corrected: number;
}

export interface MontageVoiceTrackReport {
  readonly assetId: string;
  readonly durationMs: number;
  readonly truncatedMs: number;
}

export interface MontageJobReport {
  readonly catalogPath: string;
  readonly timelinePath: string;
  readonly editDecisionListPath: string;
  readonly preset: MontagePresetName;
  readonly seed: number;
  readonly logoAssetId: string | null;
  readonly scriptAlignment: MontageScriptAlignmentReport | null;
  readonly voiceSource: VoiceSource;
  readonly voiceTrack: MontageVoiceTrackReport | null;
  readonly captionStyle: CaptionStyle;
}

interface JobBase {
  readonly id: string;
  readonly slug: string;
  readonly state: RenderJobState;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: RenderApiErrorPayload | null;
}

export type RenderJob = JobBase & {
  readonly kind: 'render';
  readonly progress: RenderJobProgress | null;
  readonly report: RenderPipelineReport | null;
};

export type MontageJob = JobBase & {
  readonly kind: 'montage';
  readonly progress: MontageJobProgress | null;
  readonly report: MontageJobReport | null;
};

export type StoryboardJob = JobBase & {
  readonly kind: 'storyboard';
  readonly progress: StoryboardJobProgress | null;
  readonly report: StoryboardJobReport | null;
};

export type VoiceJob = JobBase & {
  readonly kind: 'voice';
  readonly progress: VoiceJobProgress | null;
  readonly report: VoiceJobReport | null;
};

export type PhotoArollJob = JobBase & {
  readonly kind: 'photo-aroll';
  readonly progress: PhotoArollJobProgress | null;
  readonly report: PhotoArollJobReport | null;
};

export type MotionJob = JobBase & {
  readonly kind: 'motion';
  readonly progress: MotionJobProgress | null;
  readonly report: MotionJobReport | null;
};

export type PublishJob = JobBase & {
  readonly kind: 'publish';
  readonly progress: PublishJobProgress | null;
  readonly report: PublishJobReport | null;
};

export type ReviewJob = JobBase & {
  readonly kind: 'review';
  readonly progress: ReviewJobProgress | null;
  readonly report: ReviewJobReport | null;
};

export type ReferenceJob = JobBase & {
  readonly kind: 'reference';
  readonly progress: ReferenceJobProgress | null;
  readonly report: ReferenceJobReport | null;
};

export type Job =
  | RenderJob
  | MontageJob
  | StoryboardJob
  | VoiceJob
  | PhotoArollJob
  | MotionJob
  | PublishJob
  | ReviewJob
  | ReferenceJob;

export interface JobSummary {
  readonly id: string;
  readonly kind: JobKind;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | MontageStage | StoryboardStage | VoiceStage | PhotoArollStage | MotionStage | PublishStage | ReviewStage | ReferenceStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly sample: boolean;
}

export type RenderJobSummary = JobSummary;

export type CreateJobInput =
  | CreateRenderJobInput
  | CreateMontageJobInput
  | CreateStoryboardJobInput
  | CreateVoiceJobInput
  | CreatePhotoArollJobInput
  | CreateMotionJobInput
  | CreatePublishJobInput
  | CreateReviewJobInput
  | CreateReferenceJobInput;

export interface CreateRenderJobInput {
  readonly kind: 'render';
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
  readonly sample?: SampleSpec;
}

export interface CreateMontageJobInput {
  readonly kind: 'montage';
  readonly slug: string;
  readonly projectRoot: string;
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
}

export interface CreateStoryboardJobInput {
  readonly kind: 'storyboard';
  readonly slug: string;
  readonly projectRoot: string;
  readonly brief: string | null;
  readonly scriptText: string | null;
  readonly model: string | null;
}

export interface CreateVoiceJobInput {
  readonly kind: 'voice';
  readonly slug: string;
  readonly projectRoot: string;
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
}

export interface CreatePhotoArollJobInput {
  readonly kind: 'photo-aroll';
  readonly slug: string;
  readonly projectRoot: string;
  readonly photos: readonly string[];
  readonly output: string;
  readonly fps: number;
}

export interface CreateMotionJobInput {
  readonly kind: 'motion';
  readonly slug: string;
  readonly projectRoot: string;
  readonly phase: MotionPhase;
  readonly output: string;
  readonly takes: number;
  readonly sample?: SampleSpec;
}

export interface CreateReviewJobInput {
  readonly kind: 'review';
  readonly slug: string;
  readonly projectRoot: string;
  readonly file: string;
}

export interface CreateReferenceJobInput {
  readonly kind: 'reference';
  readonly slug: string;
  readonly projectRoot: string;
  readonly file: string;
}

export interface CreatePublishJobInput {
  readonly kind: 'publish';
  readonly slug: string;
  readonly projectRoot: string;
  readonly platform: PublishPlatform;
  readonly file: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly privacy: PublishPrivacy;
  readonly publishAt: string | null;
  readonly playlistId: string | null;
  readonly thumbnail: string | null;
  readonly categoryId: string;
  readonly madeForKids: boolean;
  readonly defaultLanguage: string;
  readonly ignoreReview: boolean;
}

export function toJob(record: RenderJob): RenderJob;
export function toJob(record: MontageJob): MontageJob;
export function toJob(record: StoryboardJob): StoryboardJob;
export function toJob(record: VoiceJob): VoiceJob;
export function toJob(record: PhotoArollJob): PhotoArollJob;
export function toJob(record: MotionJob): MotionJob;
export function toJob(record: PublishJob): PublishJob;
export function toJob(record: ReviewJob): ReviewJob;
export function toJob(record: ReferenceJob): ReferenceJob;
export function toJob(record: Job): Job;
export function toJob(record: Job): Job {
  switch (record.kind) {
    case 'render':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'render',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'montage':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'montage',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'storyboard':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'storyboard',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'voice':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'voice',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'photo-aroll':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'photo-aroll',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'motion':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'motion',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'publish':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'publish',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'review':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'review',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
    case 'reference':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'reference',
        state: record.state,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        progress: record.progress,
        report: record.report,
        error: record.error,
      };
  }
}

function isSampleJob(job: Job): boolean {
  return (job.kind === 'render' || job.kind === 'motion') && job.report?.sample === true;
}

export function toJobSummary(job: Job): JobSummary {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    stage: job.progress?.stage ?? null,
    errorCode: job.error?.code ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    sample: isSampleJob(job),
  };
}
