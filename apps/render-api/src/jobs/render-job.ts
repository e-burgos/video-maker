import type { MontagePresetName } from '@video-maker/auto-montage';
import type { OutputPreset } from '@video-maker/timeline-core';
import type { StoryboardSource, Timeline, VoiceTrackSource } from '@video-maker/timeline-core';

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

export type JobKind = 'render' | 'montage' | 'storyboard' | 'voice' | 'assemble';

export const MONTAGE_STAGES = ['discover', 'probe', 'transcribe', 'plan'] as const;
export type MontageStage = (typeof MONTAGE_STAGES)[number];

export const STORYBOARD_STAGES = ['collect', 'propose', 'persist'] as const;
export type StoryboardStage = (typeof STORYBOARD_STAGES)[number];

export const VOICE_STAGES = ['synthesize', 'transcribe', 'persist'] as const;
export type VoiceStage = (typeof VOICE_STAGES)[number];

export const ASSEMBLE_STAGES = ['collect', 'build', 'persist'] as const;
export type AssembleStage = (typeof ASSEMBLE_STAGES)[number];

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

export interface AssembleJobProgress {
  readonly stage: AssembleStage;
  readonly percent: number | null;
}

export interface AssembleJobReport {
  readonly timelinePath: string;
  readonly editDecisionListPath: null;
  readonly storyboardId: string;
  readonly outputPreset: OutputPreset;
  readonly durationFrames: number;
  readonly sceneCount: number;
  readonly scenesWithVoice: number;
  readonly scenesWithoutVoice: readonly string[];
  readonly scenesWithoutVisual: readonly string[];
}

export interface VoiceJobSceneReport {
  readonly sceneId: string;
  readonly path: string;
  readonly wordsPath: string;
  readonly durationMs: number;
  readonly source: VoiceTrackSource;
}

export interface VoiceJobReport {
  readonly manifestPath: string;
  readonly storyboardId: string;
  readonly voiceId: string;
  readonly language: string;
  readonly scenes: readonly VoiceJobSceneReport[];
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
}

export interface MontageJobReport {
  readonly catalogPath: string;
  readonly timelinePath: string;
  readonly editDecisionListPath: string;
  readonly preset: MontagePresetName;
  readonly seed: number;
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

export type AssembleJob = JobBase & {
  readonly kind: 'assemble';
  readonly progress: AssembleJobProgress | null;
  readonly report: AssembleJobReport | null;
};

export type Job = RenderJob | MontageJob | StoryboardJob | VoiceJob | AssembleJob;

export interface JobSummary {
  readonly id: string;
  readonly kind: JobKind;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | MontageStage | StoryboardStage | VoiceStage | AssembleStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export type RenderJobSummary = JobSummary;

export type CreateJobInput =
  | CreateRenderJobInput
  | CreateMontageJobInput
  | CreateStoryboardJobInput
  | CreateVoiceJobInput
  | CreateAssembleJobInput;

export interface CreateRenderJobInput {
  readonly kind: 'render';
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
}

export interface CreateMontageJobInput {
  readonly kind: 'montage';
  readonly slug: string;
  readonly projectRoot: string;
  readonly preset: MontagePresetName;
  readonly seed: number;
}

export interface CreateStoryboardJobInput {
  readonly kind: 'storyboard';
  readonly slug: string;
  readonly projectRoot: string;
  readonly brief: string | null;
  readonly scriptText: string | null;
}

export interface CreateVoiceJobInput {
  readonly kind: 'voice';
  readonly slug: string;
  readonly projectRoot: string;
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
}

export interface CreateAssembleJobInput {
  readonly kind: 'assemble';
  readonly slug: string;
  readonly projectRoot: string;
  readonly musicAssetId: string | null;
  readonly scenePaddingMs: number | null;
}

export function toJob(record: RenderJob): RenderJob;
export function toJob(record: MontageJob): MontageJob;
export function toJob(record: StoryboardJob): StoryboardJob;
export function toJob(record: VoiceJob): VoiceJob;
export function toJob(record: AssembleJob): AssembleJob;
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
    case 'assemble':
      return {
        id: record.id,
        slug: record.slug,
        kind: 'assemble',
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
  };
}
