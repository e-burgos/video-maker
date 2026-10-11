import { MOTION_STAGES } from './motion-types';
import { responseShapeUnexpected } from './render-api-error';
import {
  JOB_KINDS,
  MONTAGE_STAGES,
  RENDER_JOB_STATES,
  RENDER_PIPELINE_STAGES,
  STORYBOARD_SOURCES,
  STORYBOARD_STAGES,
  TERMINAL_RENDER_JOB_STATES,
  VOICE_JOB_SOURCES,
  VOICE_STAGES,
  VOICE_TRACK_SOURCES,
} from './render-api-types';
import type {
  Job,
  JobKind,
  MontageJob,
  MontageJobProgress,
  MontageJobReport,
  MontageStage,
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
  StoryboardJob,
  StoryboardJobProgress,
  StoryboardJobReport,
  StoryboardJobSource,
  StoryboardJobUsage,
  StoryboardStage,
  VoiceJob,
  VoiceJobProgress,
  VoiceJobReport,
  VoiceJobSceneReport,
  VoiceJobSource,
  VoiceJobTrackReport,
  VoiceStage,
  VoiceTrackSource,
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

export function isJobKind(value: unknown): value is JobKind {
  return typeof value === 'string' && (JOB_KINDS as readonly string[]).includes(value);
}

export function isMontageStage(value: unknown): value is MontageStage {
  return typeof value === 'string' && (MONTAGE_STAGES as readonly string[]).includes(value);
}

export function isStoryboardStage(value: unknown): value is StoryboardStage {
  return typeof value === 'string' && (STORYBOARD_STAGES as readonly string[]).includes(value);
}

export function isStoryboardJobSource(value: unknown): value is StoryboardJobSource {
  return typeof value === 'string' && (STORYBOARD_SOURCES as readonly string[]).includes(value);
}

export function isVoiceStage(value: unknown): value is VoiceStage {
  return typeof value === 'string' && (VOICE_STAGES as readonly string[]).includes(value);
}

export function isVoiceTrackSource(value: unknown): value is VoiceTrackSource {
  return typeof value === 'string' && (VOICE_TRACK_SOURCES as readonly string[]).includes(value);
}

export function isTerminalRenderJobState(state: RenderJobState): boolean {
  return (TERMINAL_RENDER_JOB_STATES as readonly RenderJobState[]).includes(state);
}

export function showsFrameProgress(
  progress: RenderJobProgress | null,
): progress is RenderJobProgress & { stage: 'render' } {
  return progress !== null && progress.stage === 'render';
}

export function showsSceneProgress(
  progress: VoiceJobProgress | null,
): progress is VoiceJobProgress & { processedScenes: number; totalScenes: number } {
  return progress !== null && progress.processedScenes !== null && progress.totalScenes !== null;
}

export function showsAssetProgress(
  progress: MontageJobProgress | null,
): progress is MontageJobProgress {
  return progress !== null && (progress.stage === 'probe' || progress.stage === 'transcribe');
}

function isStoryboardJobProgress(value: unknown): value is StoryboardJobProgress {
  return isRecord(value) && isStoryboardStage(value['stage']) && isNumberOrNull(value['percent']);
}

function isStoryboardJobUsage(value: unknown): value is StoryboardJobUsage {
  return (
    isRecord(value) &&
    typeof value['tokensIn'] === 'number' &&
    typeof value['tokensOut'] === 'number' &&
    isNumberOrNull(value['costUsd']) &&
    isStringOrNull(value['model'])
  );
}

function isStoryboardJobReport(value: unknown): value is StoryboardJobReport {
  return (
    isRecord(value) &&
    typeof value['storyboardPath'] === 'string' &&
    typeof value['storyboardId'] === 'string' &&
    isStoryboardJobSource(value['source']) &&
    typeof value['language'] === 'string' &&
    typeof value['sceneCount'] === 'number' &&
    isStoryboardJobUsage(value['usage'])
  );
}

function isVoiceJobProgress(value: unknown): value is VoiceJobProgress {
  return (
    isRecord(value) &&
    isVoiceStage(value['stage']) &&
    isNumberOrNull(value['processedScenes']) &&
    isNumberOrNull(value['totalScenes']) &&
    isNumberOrNull(value['percent'])
  );
}

function isVoiceJobSceneReport(value: unknown): value is VoiceJobSceneReport {
  return (
    isRecord(value) &&
    typeof value['sceneId'] === 'string' &&
    typeof value['path'] === 'string' &&
    typeof value['wordsPath'] === 'string' &&
    typeof value['durationMs'] === 'number' &&
    isVoiceTrackSource(value['source'])
  );
}

export function isVoiceJobSource(value: unknown): value is VoiceJobSource {
  return typeof value === 'string' && (VOICE_JOB_SOURCES as readonly string[]).includes(value);
}

function isVoiceJobTrackReport(value: unknown): value is VoiceJobTrackReport {
  return (
    isRecord(value) &&
    typeof value['path'] === 'string' &&
    typeof value['wordsPath'] === 'string' &&
    typeof value['durationMs'] === 'number' &&
    typeof value['lineCount'] === 'number' &&
    typeof value['gapMs'] === 'number'
  );
}

function isVoiceJobReport(value: unknown): value is VoiceJobReport {
  return (
    isRecord(value) &&
    isVoiceJobSource(value['source']) &&
    (value['track'] === null || isVoiceJobTrackReport(value['track'])) &&
    typeof value['manifestPath'] === 'string' &&
    isStringOrNull(value['storyboardId']) &&
    typeof value['voiceId'] === 'string' &&
    typeof value['language'] === 'string' &&
    Array.isArray(value['scenes']) &&
    value['scenes'].every(isVoiceJobSceneReport)
  );
}

function isMontageJobProgress(value: unknown): value is MontageJobProgress {
  return (
    isRecord(value) &&
    isMontageStage(value['stage']) &&
    isNumberOrNull(value['processedAssets']) &&
    isNumberOrNull(value['totalAssets']) &&
    isNumberOrNull(value['percent'])
  );
}

function isMontageJobReport(value: unknown): value is MontageJobReport {
  return (
    isRecord(value) &&
    typeof value['catalogPath'] === 'string' &&
    typeof value['timelinePath'] === 'string' &&
    typeof value['editDecisionListPath'] === 'string' &&
    typeof value['preset'] === 'string' &&
    typeof value['seed'] === 'number'
  );
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

function isMotionJobProgress(value: unknown): boolean {
  return isRecord(value) && (MOTION_STAGES as readonly string[]).includes(value['stage'] as string);
}

function isMotionJobReport(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value['path'] === null || typeof value['path'] === 'string') &&
    (value['durationSec'] === null || typeof value['durationSec'] === 'number') &&
    typeof value['scenes'] === 'number' &&
    (value['musicCredit'] === undefined || value['musicCredit'] === null || typeof value['musicCredit'] === 'string') &&
    (value['storyboard'] === null || isRecord(value['storyboard']))
  );
}

function isPublishJobProgress(value: unknown): boolean {
  return isRecord(value) && typeof value['stage'] === 'string' && isNumberOrNull(value['percent'] ?? null);
}

function isPublishJobReport(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['videoId'] === 'string' &&
    typeof value['url'] === 'string' &&
    typeof value['privacy'] === 'string' &&
    isStringOrNull(value['publishAt'] ?? null) &&
    typeof value['title'] === 'string'
  );
}

function isReviewJobReport(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['file'] === 'string' &&
    typeof value['reviewFile'] === 'string' &&
    (value['status'] === 'pass' || value['status'] === 'warn' || value['status'] === 'fail') &&
    isRecord(value['counts'])
  );
}

function isRenderApiErrorPayload(value: unknown): value is RenderApiErrorPayload {
  return isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string';
}

function hasJobBaseShape(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isJobKind(value['kind']) &&
    typeof value['slug'] === 'string' &&
    isRenderJobState(value['state']) &&
    typeof value['createdAt'] === 'string' &&
    isStringOrNull(value['startedAt']) &&
    isStringOrNull(value['finishedAt']) &&
    (value['error'] === null || isRenderApiErrorPayload(value['error']))
  );
}

function isJob(value: unknown): value is Job {
  if (!hasJobBaseShape(value)) {
    return false;
  }

  if (value['kind'] === 'montage') {
    return (
      (value['progress'] === null || isMontageJobProgress(value['progress'])) &&
      (value['report'] === null || isMontageJobReport(value['report']))
    );
  }

  if (value['kind'] === 'storyboard') {
    return (
      (value['progress'] === null || isStoryboardJobProgress(value['progress'])) &&
      (value['report'] === null || isStoryboardJobReport(value['report']))
    );
  }

  if (value['kind'] === 'motion') {
    return (
      (value['progress'] === null || isMotionJobProgress(value['progress'])) &&
      (value['report'] === null || isMotionJobReport(value['report']))
    );
  }

  if (value['kind'] === 'publish') {
    return (
      (value['progress'] === null || isPublishJobProgress(value['progress'])) &&
      (value['report'] === null || isPublishJobReport(value['report']))
    );
  }

  if (value['kind'] === 'review') {
    return (
      (value['progress'] === null || isPublishJobProgress(value['progress'])) &&
      (value['report'] === null || isReviewJobReport(value['report']))
    );
  }

  if (value['kind'] === 'voice') {
    return (
      (value['progress'] === null || isVoiceJobProgress(value['progress'])) &&
      (value['report'] === null || isVoiceJobReport(value['report']))
    );
  }

  return (
    (value['progress'] === null || isRenderJobProgress(value['progress'])) &&
    (value['report'] === null || isRenderPipelineReport(value['report']))
  );
}

export function parseJob(value: unknown): Job {
  if (!isJob(value)) {
    throw responseShapeUnexpected(200, 'a job document');
  }

  return value;
}

export function parseRenderJob(value: unknown): RenderJob {
  const job = parseJob(value);
  if (job.kind !== 'render') {
    throw responseShapeUnexpected(200, 'a render job document');
  }

  return job;
}

export function parseMontageJob(value: unknown): MontageJob {
  const job = parseJob(value);
  if (job.kind !== 'montage') {
    throw responseShapeUnexpected(200, 'a montage job document');
  }

  return job;
}

export function parseStoryboardJob(value: unknown): StoryboardJob {
  const job = parseJob(value);
  if (job.kind !== 'storyboard') {
    throw responseShapeUnexpected(200, 'a storyboard job document');
  }

  return job;
}

export function parseVoiceJob(value: unknown): VoiceJob {
  const job = parseJob(value);
  if (job.kind !== 'voice') {
    throw responseShapeUnexpected(200, 'a voice job document');
  }

  return job;
}

function isRenderJobSummary(value: unknown): value is RenderJobSummary {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isJobKind(value['kind']) &&
    isRenderJobState(value['state']) &&
    (value['stage'] === null ||
      isRenderPipelineStage(value['stage']) ||
      isMontageStage(value['stage']) ||
      isStoryboardStage(value['stage']) ||
      isVoiceStage(value['stage']) ||
      ((value['kind'] === 'publish' || value['kind'] === 'review') && typeof value['stage'] === 'string') ||
      (MOTION_STAGES as readonly string[]).includes(value['stage'] as string)) &&
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
