import type { PublishQueueAddInput } from './publish-queue-types';
import type { YouTubePrivacy, YouTubePublishInput } from './youtube-types';

export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_DESCRIPTION_MAX = 5000;
export const YOUTUBE_TAGS_MAX_CHARS = 500;

export type YouTubePublishFormValues = {
  file: string;
  title: string;
  description: string;
  tags: readonly string[];
  privacy: YouTubePrivacy;
  scheduled: boolean;
  publishAtLocal: string;
  playlistId: string;
  thumbnail: string;
};

export type YouTubePublishIssue =
  | 'fileMissing'
  | 'titleEmpty'
  | 'titleTooLong'
  | 'descriptionTooLong'
  | 'tagsTooLong'
  | 'scheduleMissing'
  | 'scheduleNotFuture';

export function emptyPublishFormValues(privacy: YouTubePrivacy, file: string): YouTubePublishFormValues {
  return {
    file,
    title: '',
    description: '',
    tags: [],
    privacy,
    scheduled: false,
    publishAtLocal: '',
    playlistId: '',
    thumbnail: '',
  };
}

export function tagsCharCount(tags: readonly string[]): number {
  return tags.reduce((total, tag) => total + tag.length, 0);
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/u, '').replace(/\s+/gu, ' ').trim();
}

export function addTags(current: readonly string[], raw: string): string[] {
  const next = [...current];
  for (const piece of raw.split(/[,\n]/u)) {
    const tag = normalizeTag(piece);
    const duplicated = next.some((existing) => existing.toLowerCase() === tag.toLowerCase());
    if (tag !== '' && !duplicated) {
      next.push(tag);
    }
  }
  return next;
}

export function removeTag(current: readonly string[], tag: string): string[] {
  return current.filter((existing) => existing !== tag);
}

function parseLocalDateTime(local: string): Date | null {
  if (local === '') {
    return null;
  }
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function publishIssues(values: YouTubePublishFormValues, now: Date): YouTubePublishIssue[] {
  const issues: YouTubePublishIssue[] = [];
  const title = values.title.trim();

  if (values.file === '') {
    issues.push('fileMissing');
  }
  if (title === '') {
    issues.push('titleEmpty');
  }
  if (title.length > YOUTUBE_TITLE_MAX) {
    issues.push('titleTooLong');
  }
  if (values.description.length > YOUTUBE_DESCRIPTION_MAX) {
    issues.push('descriptionTooLong');
  }
  if (tagsCharCount(values.tags) > YOUTUBE_TAGS_MAX_CHARS) {
    issues.push('tagsTooLong');
  }
  if (values.scheduled) {
    const when = parseLocalDateTime(values.publishAtLocal);
    if (when === null) {
      issues.push('scheduleMissing');
    } else if (when.getTime() <= now.getTime()) {
      issues.push('scheduleNotFuture');
    }
  }

  return issues;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function localDateTimeValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildPublishInput(values: YouTubePublishFormValues, ignoreReview = false): YouTubePublishInput {
  const scheduledAt = values.scheduled ? parseLocalDateTime(values.publishAtLocal) : null;

  return {
    file: values.file,
    title: values.title.trim(),
    description: values.description,
    tags: [...values.tags],
    privacy: values.privacy,
    ...(scheduledAt === null ? {} : { publishAt: scheduledAt.toISOString() }),
    ...(values.playlistId === '' ? {} : { playlistId: values.playlistId }),
    ...(values.thumbnail === '' ? {} : { thumbnail: values.thumbnail }),
    ...(ignoreReview ? { ignoreReview: true as const } : {}),
  };
}

export function buildQueueInput(
  slug: string,
  values: YouTubePublishFormValues,
  ignoreReview = false,
): PublishQueueAddInput {
  const scheduledAt = values.scheduled ? parseLocalDateTime(values.publishAtLocal) : null;

  return {
    slug,
    file: values.file,
    title: values.title.trim(),
    description: values.description,
    tags: [...values.tags],
    privacy: values.privacy,
    ...(scheduledAt === null ? {} : { publishAt: scheduledAt.toISOString() }),
    ...(values.playlistId === '' ? {} : { playlistIds: [values.playlistId] }),
    ...(values.thumbnail === '' ? {} : { thumbnail: values.thumbnail }),
    ...(ignoreReview ? { ignoreReview: true } : {}),
  };
}

export function formatPublishDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${pad(whole % 60)}`;
}
