import { responseShapeUnexpected } from './render-api-error';
import {
  RENDER_JOB_STATES,
  RENDER_PIPELINE_STAGES,
  TERMINAL_RENDER_JOB_STATES,
} from './render-api-types';
import type {
  RenderApiErrorPayload,
  RenderDeliverableReport,
  RenderIntermediatesReport,
  RenderJob,
  RenderJobListing,
  RenderJobProgress,
  RenderJobState,
  RenderJobSummary,
  RenderLoudnessReport,
  RenderPipelineReport,
  RenderPipelineStage,
} from './render-api-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

export function isRenderJobState(value: unknown): value is RenderJobState {
  return typeof value === 'string' && (RENDER_JOB_STATES as readonly string[]).includes(value);
}

export function isRenderPipelineStage(value: unknown): value is RenderPipelineStage {
  return typeof value === 'string' && (RENDER_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isTerminalRenderJobState(state: RenderJobState): boolean {
  return (TERMINAL_RENDER_JOB_STATES as readonly RenderJobState[]).includes(state);
}

export function showsFrameProgress(
  progress: RenderJobProgress | null,
): progress is RenderJobProgress & { stage: 'render' } {
  return progress !== null && progress.stage === 'render';
}

function isRenderJobProgress(value: unknown): value is RenderJobProgress {
  return (
    isRecord(value) &&
    isRenderPipelineStage(value['stage']) &&
    isNumberOrNull(value['renderedFrames']) &&
    isNumberOrNull(value['totalFrames']) &&
    isNumberOrNull(value['percent'])
  );
}

function isRenderDeliverableReport(value: unknown): value is RenderDeliverableReport {
  return (
    isRecord(value) &&
    typeof value['resource'] === 'string' &&
    typeof value['width'] === 'number' &&
    typeof value['height'] === 'number' &&
    typeof value['fps'] === 'number' &&
    typeof value['durationInFrames'] === 'number'
  );
}

function isRenderIntermediatesReport(value: unknown): value is RenderIntermediatesReport {
  return (
    isRecord(value) &&
    typeof value['mutedVideoResource'] === 'string' &&
    typeof value['masterAudioResource'] === 'string'
  );
}

function isRenderLoudnessReport(value: unknown): value is RenderLoudnessReport {
  return (
    isRecord(value) &&
    typeof value['withinTolerance'] === 'boolean' &&
    typeof value['integratedLufs'] === 'number' &&
    typeof value['truePeakDbtp'] === 'number' &&
    typeof value['integratedDeltaLu'] === 'number' &&
    typeof value['truePeakDeltaDb'] === 'number'
  );
}

function isRenderPipelineReport(value: unknown): value is RenderPipelineReport {
  return (
    isRecord(value) &&
    typeof value['renderId'] === 'string' &&
    typeof value['startedAt'] === 'string' &&
    typeof value['finishedAt'] === 'string' &&
    isRenderDeliverableReport(value['deliverable']) &&
    isRenderIntermediatesReport(value['intermediates']) &&
    isRenderLoudnessReport(value['loudness'])
  );
}

function isRenderApiErrorPayload(value: unknown): value is RenderApiErrorPayload {
  return isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string';
}

function isRenderJob(value: unknown): value is RenderJob {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['slug'] === 'string' &&
    isRenderJobState(value['state']) &&
    typeof value['createdAt'] === 'string' &&
    isStringOrNull(value['startedAt']) &&
    isStringOrNull(value['finishedAt']) &&
    (value['progress'] === null || isRenderJobProgress(value['progress'])) &&
    (value['report'] === null || isRenderPipelineReport(value['report'])) &&
    (value['error'] === null || isRenderApiErrorPayload(value['error']))
  );
}

export function parseRenderJob(value: unknown): RenderJob {
  if (!isRenderJob(value)) {
    throw responseShapeUnexpected(200, 'a render job document');
  }

  return value;
}

function isRenderJobSummary(value: unknown): value is RenderJobSummary {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isRenderJobState(value['state']) &&
    (value['stage'] === null || isRenderPipelineStage(value['stage'])) &&
    isStringOrNull(value['errorCode']) &&
    typeof value['createdAt'] === 'string' &&
    isStringOrNull(value['startedAt']) &&
    isStringOrNull(value['finishedAt'])
  );
}

function isRenderJobListing(value: unknown): value is RenderJobListing {
  return (
    isRecord(value) &&
    typeof value['slug'] === 'string' &&
    Array.isArray(value['jobs']) &&
    value['jobs'].every(isRenderJobSummary)
  );
}

export function parseRenderJobListing(value: unknown): RenderJobListing {
  if (!isRenderJobListing(value)) {
    throw responseShapeUnexpected(200, 'a render job listing');
  }

  return value;
}
