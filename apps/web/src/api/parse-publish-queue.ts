import { responseShapeUnexpected } from './render-api-error';
import { isYouTubePrivacy } from './parse-youtube';
import { PUBLISH_QUEUE_STATUSES } from './publish-queue-types';
import type { RenderApiErrorPayload } from './render-api-types';
import type {
  CategoryPlaylists,
  PublishQueue,
  PublishQueueAddResult,
  PublishQueueItem,
  PublishQueueMetadata,
  PublishQueueSettings,
  PublishQueueStatus,
} from './publish-queue-types';
import type { YouTubePlaylist } from './youtube-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isOptional(value: unknown, check: (candidate: unknown) => boolean): boolean {
  return value === undefined || value === null || check(value);
}

function isStatus(value: unknown): value is PublishQueueStatus {
  return typeof value === 'string' && (PUBLISH_QUEUE_STATUSES as readonly string[]).includes(value);
}

function isErrorPayload(value: unknown): value is RenderApiErrorPayload {
  return isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string';
}

function parseMetadata(value: unknown, context: string): PublishQueueMetadata {
  if (
    !isRecord(value) ||
    typeof value['title'] !== 'string' ||
    !isYouTubePrivacy(value['privacy']) ||
    !isOptional(value['description'], (v) => typeof v === 'string') ||
    !isOptional(value['tags'], isStringArray) ||
    !isOptional(value['publishAt'], (v) => typeof v === 'string') ||
    !isOptional(value['playlistIds'], isStringArray) ||
    !isOptional(value['thumbnail'], (v) => typeof v === 'string') ||
    !isOptional(value['categoryId'], (v) => typeof v === 'string') ||
    !isOptional(value['madeForKids'], (v) => typeof v === 'boolean') ||
    !isOptional(value['defaultLanguage'], (v) => typeof v === 'string') ||
    !isOptional(value['ignoreReview'], (v) => typeof v === 'boolean')
  ) {
    throw responseShapeUnexpected(200, context);
  }

  return {
    title: value['title'],
    description: typeof value['description'] === 'string' ? value['description'] : '',
    tags: isStringArray(value['tags']) ? value['tags'] : [],
    privacy: value['privacy'],
    ...(typeof value['publishAt'] === 'string' ? { publishAt: value['publishAt'] } : {}),
    ...(isStringArray(value['playlistIds']) ? { playlistIds: value['playlistIds'] } : {}),
    ...(typeof value['thumbnail'] === 'string' ? { thumbnail: value['thumbnail'] } : {}),
    ...(typeof value['categoryId'] === 'string' ? { categoryId: value['categoryId'] } : {}),
    ...(typeof value['madeForKids'] === 'boolean' ? { madeForKids: value['madeForKids'] } : {}),
    ...(typeof value['defaultLanguage'] === 'string' ? { defaultLanguage: value['defaultLanguage'] } : {}),
    ...(typeof value['ignoreReview'] === 'boolean' ? { ignoreReview: value['ignoreReview'] } : {}),
  };
}

export function parsePublishQueueItem(value: unknown): PublishQueueItem {
  const context = 'a publish queue item';
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['slug'] !== 'string' ||
    typeof value['file'] !== 'string' ||
    typeof value['position'] !== 'number' ||
    !isStatus(value['status']) ||
    typeof value['attempts'] !== 'number' ||
    !(value['lastError'] === null || value['lastError'] === undefined || isErrorPayload(value['lastError'])) ||
    !isStringOrNull(value['nextAttemptAt'] ?? null) ||
    !isStringOrNull(value['jobId'] ?? null) ||
    !isStringOrNull(value['url'] ?? null)
  ) {
    throw responseShapeUnexpected(200, context);
  }

  return {
    id: value['id'],
    slug: value['slug'],
    file: value['file'],
    metadata: parseMetadata(value['metadata'], context),
    position: value['position'],
    status: value['status'],
    attempts: value['attempts'],
    lastError: isErrorPayload(value['lastError']) ? value['lastError'] : null,
    nextAttemptAt: (value['nextAttemptAt'] as string | null | undefined) ?? null,
    jobId: (value['jobId'] as string | null | undefined) ?? null,
    url: (value['url'] as string | null | undefined) ?? null,
  };
}

export function parsePublishQueueSettings(value: unknown): PublishQueueSettings {
  if (!isRecord(value) || typeof value['paused'] !== 'boolean' || typeof value['dailyLimit'] !== 'number') {
    throw responseShapeUnexpected(200, 'publish queue settings');
  }

  return { paused: value['paused'], dailyLimit: value['dailyLimit'] };
}

export function parsePublishQueue(value: unknown): PublishQueue {
  if (
    !isRecord(value) ||
    typeof value['publishedLast24h'] !== 'number' ||
    !isStringOrNull(value['nextAttemptAt'] ?? null) ||
    !Array.isArray(value['items'])
  ) {
    throw responseShapeUnexpected(200, 'a publish queue document');
  }

  return {
    settings: parsePublishQueueSettings(value['settings']),
    publishedLast24h: value['publishedLast24h'],
    nextAttemptAt: (value['nextAttemptAt'] as string | null | undefined) ?? null,
    items: value['items'].map(parsePublishQueueItem),
  };
}

export function parsePublishQueueAddResult(value: unknown): PublishQueueAddResult {
  if (!isRecord(value)) {
    throw responseShapeUnexpected(200, 'a publish queue add result');
  }
  const already = value['alreadyPublished'];
  if (!(already === null || already === undefined || (isRecord(already) && isStringOrNull(already['url'] ?? null)))) {
    throw responseShapeUnexpected(200, 'a publish queue add result');
  }

  return {
    item: parsePublishQueueItem(value['item']),
    alreadyPublished: isRecord(already) ? { url: (already['url'] as string | null | undefined) ?? null } : null,
  };
}

export function parseCategoryPlaylists(value: unknown): CategoryPlaylists {
  if (
    !isRecord(value) ||
    !isRecord(value['categoryPlaylists']) ||
    !Object.values(value['categoryPlaylists']).every(isStringOrNull) ||
    !isStringOrNull(value['generalPlaylistId'] ?? null)
  ) {
    throw responseShapeUnexpected(200, 'a category playlists document');
  }

  return {
    categoryPlaylists: { ...(value['categoryPlaylists'] as Record<string, string | null>) },
    generalPlaylistId: (value['generalPlaylistId'] as string | null | undefined) ?? null,
  };
}

export function parseYouTubePlaylistListing(value: unknown): YouTubePlaylist[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value['playlists']) ||
    !value['playlists'].every(
      (entry) => isRecord(entry) && typeof entry['id'] === 'string' && typeof entry['title'] === 'string',
    )
  ) {
    throw responseShapeUnexpected(200, 'a youtube playlist listing');
  }

  return (value['playlists'] as { id: string; title: string }[]).map((entry) => ({
    id: entry.id,
    title: entry.title,
  }));
}
