import type { LogoMode, MontagePresetName, VoiceSource } from '@video-maker/auto-montage';
import type { JobRecord as StoredJobRow } from '@video-maker/local-store';
import { TimelineSchema } from '@video-maker/timeline-core';
import type { CaptionStyle, MusicMode, OutputPreset } from '@video-maker/timeline-core';

import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import type {
  CreateJobInput,
  CreateMontageJobInput,
  CreateMotionJobInput,
  CreatePhotoArollJobInput,
  CreatePublishJobInput,
  CreateRenderJobInput,
  CreateReferenceJobInput,
  CreateReviewJobInput,
  CreateStoryboardJobInput,
  CreateVoiceJobInput,
  Job,
  JobKind,
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
  ReferenceJobProgress,
  ReferenceJobReport,
  RenderJobProgress,
  RenderJobState,
  ReviewJobProgress,
  ReviewJobReport,
  StoryboardJobProgress,
  StoryboardJobReport,
  VoiceJobProgress,
  VoiceJobReport,
} from './render-job';
import { isSampleSpec } from './sample-job-params';
import { MOTION_PHASES, PUBLISH_PLATFORMS, PUBLISH_PRIVACIES, RENDER_JOB_STATES } from './render-job';

export type StoredJobParams =
  | Omit<CreateRenderJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateMontageJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateStoryboardJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateVoiceJobInput, 'slug' | 'projectRoot'>
  | Omit<CreatePhotoArollJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateMotionJobInput, 'slug' | 'projectRoot'>
  | Omit<CreatePublishJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateReviewJobInput, 'slug' | 'projectRoot'>
  | Omit<CreateReferenceJobInput, 'slug' | 'projectRoot'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isJobKind(value: string): value is JobKind {
  switch (value) {
    case 'render':
    case 'montage':
    case 'storyboard':
    case 'voice':
    case 'photo-aroll':
    case 'motion':
    case 'publish':
    case 'review':
    case 'reference':
      return true;
    default:
      return false;
  }
}

function isMotionPhase(value: unknown): value is MotionPhase {
  return typeof value === 'string' && (MOTION_PHASES as readonly string[]).includes(value);
}

function isPublishPlatform(value: unknown): value is PublishPlatform {
  return typeof value === 'string' && (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}

function isPublishPrivacy(value: unknown): value is PublishPrivacy {
  return typeof value === 'string' && (PUBLISH_PRIVACIES as readonly string[]).includes(value);
}

function isRenderJobState(value: string): value is RenderJobState {
  return (RENDER_JOB_STATES as readonly string[]).includes(value);
}

export function toStoredParams(input: CreateJobInput): StoredJobParams {
  switch (input.kind) {
    case 'render':
      return { kind: 'render', timeline: input.timeline, ...(input.sample === undefined ? {} : { sample: input.sample }) };
    case 'montage':
      return {
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
      };
    case 'storyboard':
      return { kind: 'storyboard', brief: input.brief, scriptText: input.scriptText, model: input.model };
    case 'voice':
      return {
        kind: 'voice',
        voiceId: input.voiceId,
        sceneIds: input.sceneIds,
        scriptText: input.scriptText,
        scriptPath: input.scriptPath,
        gapMs: input.gapMs,
      };
    case 'photo-aroll':
      return { kind: 'photo-aroll', photos: input.photos, output: input.output, fps: input.fps };
    case 'motion':
      return {
        kind: 'motion',
        phase: input.phase,
        output: input.output,
        takes: input.takes,
        ...(input.sample === undefined ? {} : { sample: input.sample }),
      };
    case 'publish':
      return {
        kind: 'publish',
        platform: input.platform,
        file: input.file,
        title: input.title,
        description: input.description,
        tags: input.tags,
        privacy: input.privacy,
        publishAt: input.publishAt,
        playlistId: input.playlistId,
        thumbnail: input.thumbnail,
        categoryId: input.categoryId,
        madeForKids: input.madeForKids,
        defaultLanguage: input.defaultLanguage,
        ignoreReview: input.ignoreReview,
      };
    case 'review':
      return { kind: 'review', file: input.file };
    case 'reference':
      return { kind: 'reference', file: input.file };
  }
}

export function parseStoredParams(kind: JobKind, value: unknown): StoredJobParams | null {
  if (!isRecord(value)) {
    return null;
  }

  switch (kind) {
    case 'render': {
      const result = TimelineSchema.safeParse(value.timeline);
      if (!result.success || (value.sample !== undefined && !isSampleSpec(value.sample))) {
        return null;
      }
      return { kind: 'render', timeline: result.data, ...(value.sample === undefined ? {} : { sample: { seconds: value.sample.seconds } }) };
    }
    case 'montage': {
      const { preset, seed, scriptPath, scriptText, logo, format, voice, captionStyle } = value;
      if (typeof preset !== 'string' || typeof seed !== 'number') {
        return null;
      }
      if (!isStringOrNull(scriptPath) || !isStringOrNull(scriptText)) {
        return null;
      }
      if (typeof logo !== 'string' || typeof format !== 'string' || typeof voice !== 'string') {
        return null;
      }
      if (captionStyle !== null && typeof captionStyle !== 'string') {
        return null;
      }
      const { musicMode, musicFloorDb } = value;
      if (musicMode !== undefined && musicMode !== 'bed' && musicMode !== 'segments') {
        return null;
      }
      if (musicFloorDb !== undefined && typeof musicFloorDb !== 'number') {
        return null;
      }
      return {
        kind: 'montage',
        preset: preset as MontagePresetName,
        seed,
        scriptPath,
        scriptText,
        logo: logo as LogoMode,
        format: format as OutputPreset,
        voice: voice as VoiceSource,
        captionStyle: captionStyle as CaptionStyle | null,
        ...(musicMode === undefined ? {} : { musicMode: musicMode as MusicMode }),
        ...(musicFloorDb === undefined ? {} : { musicFloorDb }),
      };
    }
    case 'storyboard': {
      const { brief, scriptText, model } = value;
      if (!isStringOrNull(brief) || !isStringOrNull(scriptText) || !isStringOrNull(model)) {
        return null;
      }
      return { kind: 'storyboard', brief, scriptText, model };
    }
    case 'voice': {
      const { voiceId, sceneIds, scriptText, scriptPath, gapMs } = value;
      if (!isStringOrNull(voiceId)) {
        return null;
      }
      if (sceneIds !== null && !isStringArray(sceneIds)) {
        return null;
      }
      if (!isStringOrNull(scriptText) || !isStringOrNull(scriptPath) || typeof gapMs !== 'number') {
        return null;
      }
      return { kind: 'voice', voiceId, sceneIds, scriptText, scriptPath, gapMs };
    }
    case 'photo-aroll': {
      const { photos, output, fps } = value;
      if (!isStringArray(photos) || typeof output !== 'string' || typeof fps !== 'number') {
        return null;
      }
      return { kind: 'photo-aroll', photos, output, fps };
    }
    case 'motion': {
      const { phase, output, takes } = value;
      if (!isMotionPhase(phase) || typeof output !== 'string' || typeof takes !== 'number') {
        return null;
      }
      if (value.sample !== undefined && !isSampleSpec(value.sample)) {
        return null;
      }
      return { kind: 'motion', phase, output, takes, ...(value.sample === undefined ? {} : { sample: { seconds: value.sample.seconds } }) };
    }
    case 'publish': {
      const { platform, file, title, description, tags, privacy, publishAt, playlistId, thumbnail, categoryId, madeForKids, defaultLanguage } = value;
      if (!isPublishPlatform(platform) || typeof file !== 'string' || typeof title !== 'string') {
        return null;
      }
      if (typeof description !== 'string' || !isStringArray(tags) || !isPublishPrivacy(privacy)) {
        return null;
      }
      if (!isStringOrNull(publishAt) || !isStringOrNull(playlistId) || !isStringOrNull(thumbnail)) {
        return null;
      }
      if (typeof categoryId !== 'string' || typeof madeForKids !== 'boolean' || typeof defaultLanguage !== 'string') {
        return null;
      }
      return {
        kind: 'publish',
        platform,
        file,
        title,
        description,
        tags,
        privacy,
        publishAt,
        playlistId,
        thumbnail,
        categoryId,
        madeForKids,
        defaultLanguage,
        ignoreReview: value.ignoreReview === true,
      };
    }
    case 'review': {
      return typeof value.file === 'string' ? { kind: 'review', file: value.file } : null;
    }
    case 'reference': {
      return typeof value.file === 'string' ? { kind: 'reference', file: value.file } : null;
    }
  }
}

function invalidRecordError(jobId: string): RenderApiErrorPayload {
  return {
    code: 'JOB_RECORD_INVALID',
    stage: null,
    message: `Job ${jobId} has a persisted record this service cannot read back.`,
    resource: jobId,
  };
}

function toErrorFromRow(value: unknown): RenderApiErrorPayload | null {
  return isRecord(value) ? (value as unknown as RenderApiErrorPayload) : null;
}

function buildInvalidJob(row: StoredJobRow, kind: JobKind): Job {
  const finishedAt = row.finishedAt ?? row.createdAt;
  const base = {
    id: row.id,
    slug: row.slug,
    state: 'failed' as const,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt,
    error: invalidRecordError(row.id),
  };

  switch (kind) {
    case 'render':
      return { ...base, kind, progress: null, report: null };
    case 'montage':
      return { ...base, kind, progress: null, report: null };
    case 'storyboard':
      return { ...base, kind, progress: null, report: null };
    case 'voice':
      return { ...base, kind, progress: null, report: null };
    case 'photo-aroll':
      return { ...base, kind, progress: null, report: null };
    case 'motion':
      return { ...base, kind, progress: null, report: null };
    case 'publish':
      return { ...base, kind, progress: null, report: null };
    case 'review':
      return { ...base, kind, progress: null, report: null };
    case 'reference':
      return { ...base, kind, progress: null, report: null };
  }
}

function buildTypedJob(row: StoredJobRow, kind: JobKind, state: RenderJobState): Job {
  const progress = isRecord(row.progress) ? row.progress : null;
  const report = isRecord(row.report) ? row.report : null;
  const error = toErrorFromRow(row.error);

  const base = {
    id: row.id,
    slug: row.slug,
    state,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error,
  };

  switch (kind) {
    case 'render':
      return { ...base, kind, progress: progress as RenderJobProgress | null, report: report as RenderPipelineReport | null };
    case 'montage':
      return { ...base, kind, progress: progress as MontageJobProgress | null, report: report as MontageJobReport | null };
    case 'storyboard':
      return {
        ...base,
        kind,
        progress: progress as StoryboardJobProgress | null,
        report: report as StoryboardJobReport | null,
      };
    case 'voice':
      return { ...base, kind, progress: progress as VoiceJobProgress | null, report: report as VoiceJobReport | null };
    case 'photo-aroll':
      return {
        ...base,
        kind,
        progress: progress as PhotoArollJobProgress | null,
        report: report as PhotoArollJobReport | null,
      };
    case 'motion':
      return { ...base, kind, progress: progress as MotionJobProgress | null, report: report as MotionJobReport | null };
    case 'publish':
      return { ...base, kind, progress: progress as PublishJobProgress | null, report: report as PublishJobReport | null };
    case 'review':
      return { ...base, kind, progress: progress as ReviewJobProgress | null, report: report as ReviewJobReport | null };
    case 'reference':
      return {
        ...base,
        kind,
        progress: progress as ReferenceJobProgress | null,
        report: report as ReferenceJobReport | null,
      };
  }
}

export function parseStoredJob(row: StoredJobRow): Job {
  try {
    if (!isJobKind(row.kind)) {
      return buildInvalidJob(row, 'render');
    }
    if (!isRenderJobState(row.state)) {
      return buildInvalidJob(row, row.kind);
    }
    return buildTypedJob(row, row.kind, row.state);
  } catch {
    return buildInvalidJob(row, isJobKind(row.kind) ? row.kind : 'render');
  }
}
