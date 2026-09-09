import type { MontagePresetName } from '@video-maker/auto-montage';
import type { Timeline } from '@video-maker/timeline-core';

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

export type JobKind = 'render' | 'montage';

export const MONTAGE_STAGES = ['discover', 'probe', 'transcribe', 'plan'] as const;
export type MontageStage = (typeof MONTAGE_STAGES)[number];

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

export type Job = RenderJob | MontageJob;

export interface JobSummary {
  readonly id: string;
  readonly kind: JobKind;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | MontageStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export type RenderJobSummary = JobSummary;

export type CreateJobInput = CreateRenderJobInput | CreateMontageJobInput;

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

export function toJob(record: RenderJob): RenderJob;
export function toJob(record: MontageJob): MontageJob;
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
