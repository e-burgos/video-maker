import type { ReviewStatus } from '@video-maker/timeline-core';
import { responseShapeUnexpected } from './render-api-error';
import { YOUTUBE_PRIVACIES } from './youtube-types';
import type {
  Publication,
  PublishJob,
  YouTubeChannel,
  YouTubeConnectStart,
  YouTubeDraft,
  YouTubeIntegration,
  YouTubePlaylist,
  YouTubePrivacy,
  YouTubePublishFile,
  YouTubePublishOptions,
} from './youtube-types';
import type { PublicationStatus } from './render-api-types';
import { parseJob } from './parse-render-job';

const PUBLICATION_STATUSES: readonly PublicationStatus[] = ['uploading', 'published', 'scheduled', 'failed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isYouTubePrivacy(value: unknown): value is YouTubePrivacy {
  return typeof value === 'string' && (YOUTUBE_PRIVACIES as readonly string[]).includes(value);
}

function isChannel(value: unknown): value is YouTubeChannel {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    isStringOrNull(value['thumbnailUrl'] ?? null)
  );
}

function normalizeChannel(value: YouTubeChannel): YouTubeChannel {
  return { id: value.id, title: value.title, thumbnailUrl: value.thumbnailUrl ?? null };
}

export function parseYouTubeIntegration(value: unknown): YouTubeIntegration {
  if (
    !isRecord(value) ||
    typeof value['clientConfigured'] !== 'boolean' ||
    typeof value['connected'] !== 'boolean' ||
    !(value['channel'] === null || value['channel'] === undefined || isChannel(value['channel']))
  ) {
    throw responseShapeUnexpected(200, 'a youtube integration document');
  }

  return {
    clientConfigured: value['clientConfigured'],
    connected: value['connected'],
    channel: isChannel(value['channel']) ? normalizeChannel(value['channel']) : null,
  };
}

export function parseYouTubeConnectStart(value: unknown): YouTubeConnectStart {
  if (!isRecord(value) || typeof value['authUrl'] !== 'string') {
    throw responseShapeUnexpected(200, 'a youtube connect document');
  }

  return { authUrl: value['authUrl'] };
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === 'pass' || value === 'warn' || value === 'fail';
}

function isPublishFile(value: unknown): value is YouTubePublishFile {
  return (
    isRecord(value) &&
    typeof value['path'] === 'string' &&
    typeof value['durationSec'] === 'number' &&
    typeof value['width'] === 'number' &&
    typeof value['height'] === 'number' &&
    typeof value['isShort'] === 'boolean' &&
    typeof value['sizeBytes'] === 'number' &&
    (value['reviewStatus'] === undefined || value['reviewStatus'] === null || isReviewStatus(value['reviewStatus']))
  );
}

function isPlaylist(value: unknown): value is YouTubePlaylist {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['title'] === 'string';
}

export function parseYouTubePublishOptions(value: unknown): YouTubePublishOptions {
  if (
    !isRecord(value) ||
    !Array.isArray(value['files']) ||
    !value['files'].every(isPublishFile) ||
    !Array.isArray(value['playlists']) ||
    !value['playlists'].every(isPlaylist)
  ) {
    throw responseShapeUnexpected(200, 'a youtube publish options document');
  }

  const defaults = value['defaults'];
  const privacy =
    isRecord(defaults) && isYouTubePrivacy(defaults['privacy']) ? defaults['privacy'] : 'public';

  return {
    files: value['files'].map((file) => ({ ...file, reviewStatus: file.reviewStatus ?? null })),
    playlists: value['playlists'],
    defaults: { privacy },
  };
}

export function parseYouTubeDraft(value: unknown): YouTubeDraft {
  if (
    !isRecord(value) ||
    typeof value['title'] !== 'string' ||
    typeof value['description'] !== 'string' ||
    !Array.isArray(value['tags']) ||
    !value['tags'].every((tag) => typeof tag === 'string')
  ) {
    throw responseShapeUnexpected(200, 'a youtube metadata draft');
  }

  return { title: value['title'], description: value['description'], tags: value['tags'] as string[] };
}

function isPublication(value: unknown): value is Publication {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['platform'] === 'string' &&
    typeof value['file'] === 'string' &&
    typeof value['title'] === 'string' &&
    isStringOrNull(value['videoId'] ?? null) &&
    isStringOrNull(value['url'] ?? null) &&
    isYouTubePrivacy(value['privacy']) &&
    typeof value['status'] === 'string' &&
    (PUBLICATION_STATUSES as readonly string[]).includes(value['status']) &&
    isStringOrNull(value['publishAt'] ?? null) &&
    isStringOrNull(value['publishedAt'] ?? null) &&
    typeof value['createdAt'] === 'string'
  );
}

export function parsePublications(value: unknown): Publication[] {
  if (!Array.isArray(value) || !value.every(isPublication)) {
    throw responseShapeUnexpected(200, 'a publication listing');
  }

  return value.map((publication) => ({
    ...publication,
    videoId: publication.videoId ?? null,
    url: publication.url ?? null,
    publishAt: publication.publishAt ?? null,
    publishedAt: publication.publishedAt ?? null,
  }));
}

export function parsePublishJob(value: unknown): PublishJob {
  const job = parseJob(value);
  if (job.kind !== 'publish') {
    throw responseShapeUnexpected(200, 'a publish job document');
  }

  return job;
}
