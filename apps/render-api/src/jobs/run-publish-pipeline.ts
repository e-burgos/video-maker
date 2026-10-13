import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isRenderApiError } from '../errors/render-api-error';
import { collectBytes } from '../media-search/commons-shared';
import { appendCreditsOnce, readCreditsText } from '../youtube/publish-credits';
import type { YoutubeClient, YoutubeVideoMetadata } from '../youtube/youtube-client';
import { YOUTUBE_UPLOAD_SETTING_PREFIX } from '../youtube/youtube-constants';
import { PUBLISH_THUMBNAIL_MAX_BYTES, thumbnailContentType } from './publish-job-params';
import { isPublishPipelineCanceled, publishCheckpoint } from './publish-pipeline-observer';
import type { PublishPipelineObserver } from './publish-pipeline-observer';
import type { PublishJobReport, PublishPlatform, PublishPrivacy, PublishStage } from './render-job';

export const DEFAULT_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_CONSECUTIVE_UPLOAD_FAILURES = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 16_000;
const VIDEO_URL_PREFIX = 'https://youtu.be/';
const THUMBNAIL_LIMIT_LABEL = 'thumbnail';

export interface PublishPipelineRequest {
  readonly jobId: string;
  readonly slug: string;
  readonly project: MediaProject;
  readonly resume: boolean;
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
}

export interface PublishPipelineOptions {
  readonly youtube: YoutubeClient;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly chunkSizeBytes?: number;
}

interface UploadRecord {
  readonly sessionUri: string | null;
  readonly videoId: string | null;
  readonly publicationId: string | null;
}

interface PreparedPublish {
  readonly absolutePath: string;
  readonly sizeBytes: number;
  readonly metadata: YoutubeVideoMetadata;
  readonly effectivePublishAt: string | null;
  readonly recordKey: string;
}

function withStage(error: PipelineStageError, stage: PublishStage, extraHint: string | null): PipelineStageError {
  return new PipelineStageError({
    code: error.code,
    stage,
    resource: error.resource,
    expected: error.expected,
    hint: extraHint === null ? error.hint : [error.hint, extraHint].filter((part) => part !== null).join('; '),
    details: error.details,
    cause: error.cause,
  });
}

async function runPublishStage<T>(stage: PublishStage, fn: () => Promise<T>, extraHint: string | null = null): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (isPublishPipelineCanceled(cause)) {
      throw cause;
    }
    if (cause instanceof PipelineStageError) {
      throw cause.stage === null ? withStage(cause, stage, extraHint) : cause;
    }
    if (isRenderApiError(cause)) {
      throw cause;
    }
    throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage, cause });
  }
}

function invalidFile(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'PUBLISH_FILE_INVALID', stage: null, resource, expected });
}

function uploadFailed(hint: string): PipelineStageError {
  return new PipelineStageError({ code: 'YOUTUBE_UPLOAD_FAILED', stage: null, resource: 'youtube', hint });
}

function isUploadRecord(value: unknown): value is UploadRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const isTextOrNull = (field: unknown): boolean => field === null || typeof field === 'string';
  return isTextOrNull(record.sessionUri) && isTextOrNull(record.videoId) && isTextOrNull(record.publicationId);
}

function backoffMs(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readRange(
  deps: RenderApiDependencies,
  absolutePath: string,
  start: number,
  end: number,
): Promise<Uint8Array> {
  return collectBytes(deps.storage.openReadStream(absolutePath, { start, end }), end - start + 1, 'video chunk');
}

async function prepare(
  request: PublishPipelineRequest,
  deps: RenderApiDependencies,
): Promise<PreparedPublish> {
  const absolutePath = toAbsolutePath(request.project, request.file);
  const stat = await deps.storage.stat(absolutePath);
  if (stat === null || stat.kind !== 'file' || stat.sizeBytes === 0) {
    throw invalidFile(request.file, 'an existing, non-empty .mp4 under out/');
  }

  const credits = await readCreditsText(deps.storage, request.project, request.file);
  const nowMs = Date.parse(deps.clock.nowIso());
  const effectivePublishAt =
    request.publishAt !== null && Date.parse(request.publishAt) > nowMs ? request.publishAt : null;
  const metadata: YoutubeVideoMetadata = {
    title: request.title,
    description: appendCreditsOnce(request.description, credits),
    tags: request.tags,
    categoryId: request.categoryId,
    defaultLanguage: request.defaultLanguage,
    privacyStatus: effectivePublishAt === null ? request.privacy : 'private',
    publishAt: effectivePublishAt,
    madeForKids: request.madeForKids,
  };
  const recordKey =
    YOUTUBE_UPLOAD_SETTING_PREFIX +
    deps.hashText(JSON.stringify([request.slug, request.file, stat.sizeBytes, stat.modifiedAtMs, metadata]));

  return { absolutePath, sizeBytes: stat.sizeBytes, metadata, effectivePublishAt, recordKey };
}

export async function runPublishPipeline(
  request: PublishPipelineRequest,
  deps: RenderApiDependencies,
  observer: PublishPipelineObserver,
  options: PublishPipelineOptions,
): Promise<PublishJobReport> {
  const sleep = options.sleep ?? defaultSleep;
  const chunkSize = options.chunkSizeBytes ?? DEFAULT_UPLOAD_CHUNK_BYTES;
  const publications = deps.localStore.publications;

  publishCheckpoint(observer, 'prepare');
  observer.stageStarted('prepare');
  const prepared = await runPublishStage('prepare', () => prepare(request, deps));

  const storedRecord = deps.localStore.settings.get(prepared.recordKey);
  const knownRecord = isUploadRecord(storedRecord) ? storedRecord : null;
  const finishedUpload = request.resume && knownRecord !== null && knownRecord.videoId !== null ? knownRecord : null;
  const reusablePublicationId = finishedUpload?.publicationId ?? null;

  const publicationId = reusablePublicationId ?? deps.randomId();
  if (reusablePublicationId === null) {
    publications.insert({
      id: publicationId,
      slug: request.slug,
      platform: request.platform,
      file: request.file,
      title: request.title,
      privacy: prepared.metadata.privacyStatus,
      status: 'uploading',
      publishAt: prepared.effectivePublishAt,
      jobId: request.jobId,
      createdAt: deps.clock.nowIso(),
    });
  }

  let record: UploadRecord = {
    sessionUri: knownRecord?.sessionUri ?? null,
    videoId: finishedUpload?.videoId ?? null,
    publicationId,
  };
  let videoId: string | null = record.videoId;

  function saveRecord(next: UploadRecord): void {
    record = next;
    deps.localStore.settings.set(prepared.recordKey, next);
  }

  async function uploadVideo(): Promise<string> {
    let sessionUri = record.sessionUri;
    let offset = 0;

    if (sessionUri !== null) {
      const status = await options.youtube.queryUploadStatus(sessionUri, prepared.sizeBytes);
      if (status.kind === 'complete') {
        return status.videoId;
      }
      if (status.kind === 'incomplete') {
        offset = status.nextOffset;
      } else {
        sessionUri = null;
      }
    }

    if (sessionUri === null) {
      sessionUri = await options.youtube.initiateUpload(prepared.metadata, prepared.sizeBytes);
      saveRecord({ ...record, sessionUri });
    }

    observer.bytesUploaded(offset, prepared.sizeBytes);
    let failures = 0;

    for (;;) {
      publishCheckpoint(observer, 'upload');
      const offsetBefore = offset;
      const outcome =
        offset >= prepared.sizeBytes
          ? await options.youtube.queryUploadStatus(sessionUri, prepared.sizeBytes)
          : await options.youtube.uploadChunk(
              sessionUri,
              await readRange(deps, prepared.absolutePath, offset, Math.min(offset + chunkSize, prepared.sizeBytes) - 1),
              offset,
              prepared.sizeBytes,
            );

      if (outcome.kind === 'complete') {
        observer.bytesUploaded(prepared.sizeBytes, prepared.sizeBytes);
        return outcome.videoId;
      }
      if (outcome.kind === 'session-gone') {
        saveRecord({ ...record, sessionUri: null });
        throw uploadFailed('the upload session expired, retry the job to start a new upload');
      }
      if (outcome.kind === 'incomplete' && outcome.nextOffset > offsetBefore) {
        offset = outcome.nextOffset;
        failures = 0;
        observer.bytesUploaded(offset, prepared.sizeBytes);
        continue;
      }

      failures += 1;
      if (failures > MAX_CONSECUTIVE_UPLOAD_FAILURES) {
        throw uploadFailed('the upload kept failing, retry the job to resume it');
      }
      await sleep(backoffMs(failures));
      const probe = await options.youtube.queryUploadStatus(sessionUri, prepared.sizeBytes);
      if (probe.kind === 'complete') {
        observer.bytesUploaded(prepared.sizeBytes, prepared.sizeBytes);
        return probe.videoId;
      }
      if (probe.kind === 'session-gone') {
        saveRecord({ ...record, sessionUri: null });
        throw uploadFailed('the upload session expired, retry the job to start a new upload');
      }
      if (probe.kind === 'incomplete') {
        offset = probe.nextOffset;
      }
    }
  }

  async function readThumbnail(path: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const contentType = thumbnailContentType(path);
    const absolutePath = toAbsolutePath(request.project, path);
    const stat = await deps.storage.stat(absolutePath);
    if (contentType === null || stat === null || stat.kind !== 'file' || stat.sizeBytes > PUBLISH_THUMBNAIL_MAX_BYTES) {
      throw invalidFile(path, `a .png or .jpg ${THUMBNAIL_LIMIT_LABEL} of at most ${String(PUBLISH_THUMBNAIL_MAX_BYTES)} bytes`);
    }
    const bytes = await collectBytes(deps.storage.openReadStream(absolutePath), PUBLISH_THUMBNAIL_MAX_BYTES, THUMBNAIL_LIMIT_LABEL);
    return { bytes, contentType };
  }

  function markPublished(id: string): void {
    const scheduled = prepared.effectivePublishAt !== null;
    publications.update(publicationId, {
      status: scheduled ? 'scheduled' : 'published',
      videoId: id,
      url: `${VIDEO_URL_PREFIX}${id}`,
      privacy: prepared.metadata.privacyStatus,
      publishAt: prepared.effectivePublishAt,
      publishedAt: scheduled ? null : deps.clock.nowIso(),
    });
  }

  try {
    publishCheckpoint(observer, 'upload');
    observer.stageStarted('upload');
    if (videoId === null) {
      videoId = await runPublishStage('upload', uploadVideo);
      saveRecord({ sessionUri: null, videoId, publicationId });
    }
    markPublished(videoId);

    const afterUploadHint = `the video is already on YouTube at ${VIDEO_URL_PREFIX}${videoId}, retry the job to finish the rest`;

    if (request.thumbnail !== null) {
      const thumbnailPath = request.thumbnail;
      const publishedId = videoId;
      publishCheckpoint(observer, 'thumbnail');
      observer.stageStarted('thumbnail');
      await runPublishStage(
        'thumbnail',
        async () => {
          const thumbnail = await readThumbnail(thumbnailPath);
          await options.youtube.setThumbnail(publishedId, thumbnail.bytes, thumbnail.contentType);
        },
        afterUploadHint,
      );
    }

    if (request.playlistIds.length > 0) {
      const playlistIds = request.playlistIds;
      const publishedId = videoId;
      publishCheckpoint(observer, 'playlist');
      observer.stageStarted('playlist');
      await runPublishStage(
        'playlist',
        async () => {
          for (const playlistId of playlistIds) {
            await options.youtube.addToPlaylist(playlistId, publishedId);
          }
        },
        afterUploadHint,
      );
    }
  } catch (cause) {
    if (videoId === null) {
      publications.update(publicationId, { status: 'failed' });
    }
    throw cause;
  }

  deps.localStore.settings.delete(prepared.recordKey);

  return {
    videoId,
    url: `${VIDEO_URL_PREFIX}${videoId}`,
    privacy: prepared.metadata.privacyStatus,
    publishAt: prepared.effectivePublishAt,
    title: request.title,
  };
}
