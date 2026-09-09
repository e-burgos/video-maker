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

export interface RenderJobProgress {
  readonly stage: RenderPipelineStage;
  readonly renderedFrames: number | null;
  readonly totalFrames: number | null;
  readonly percent: number | null;
}

export interface RenderJob {
  readonly id: string;
  readonly slug: string;
  readonly state: RenderJobState;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly progress: RenderJobProgress | null;
  readonly report: RenderPipelineReport | null;
  readonly error: RenderApiErrorPayload | null;
}

export interface RenderJobSummary {
  readonly id: string;
  readonly state: RenderJobState;
  readonly stage: RenderPipelineStage | null;
  readonly errorCode: RenderApiErrorCode | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export function toRenderJob(record: RenderJob): RenderJob {
  return {
    id: record.id,
    slug: record.slug,
    state: record.state,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    progress: record.progress,
    report: record.report,
    error: record.error,
  };
}

export function toRenderJobSummary(job: RenderJob): RenderJobSummary {
  return {
    id: job.id,
    state: job.state,
    stage: job.progress?.stage ?? null,
    errorCode: job.error?.code ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}
