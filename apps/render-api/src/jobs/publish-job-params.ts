import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isPortableFileName } from '../store/asset-path';
import { YOUTUBE_DEFAULT_CATEGORY_ID } from '../youtube/youtube-constants';
import { PUBLISH_PLATFORMS, PUBLISH_PRIVACIES } from './render-job';
import type { PublishPlatform, PublishPrivacy } from './render-job';

export const PUBLISH_TITLE_MAX_LENGTH = 100;
export const PUBLISH_DESCRIPTION_MAX_LENGTH = 5000;
export const PUBLISH_TAGS_MAX_TOTAL_LENGTH = 500;
export const PUBLISH_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

const PUBLISH_FILE_PATTERN = /^out\/([^/]+\.mp4)$/u;
const THUMBNAIL_EXTENSIONS: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export interface PublishJobInput {
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
  readonly defaultLanguage: string | null;
  readonly ignoreReview: boolean;
}

function invalid(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function invalidFile(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'PUBLISH_FILE_INVALID', stage: null, resource, expected });
}

function parsePlatform(value: unknown): PublishPlatform {
  if (typeof value !== 'string' || !(PUBLISH_PLATFORMS as readonly string[]).includes(value)) {
    throw invalid('platform', PUBLISH_PLATFORMS.join(', '));
  }
  return value as PublishPlatform;
}

export function parsePublishFile(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidFile('file', 'a project-relative path of an .mp4 directly under out/');
  }
  const name = PUBLISH_FILE_PATTERN.exec(value)?.[1];
  if (name === undefined || !isPortableFileName(name)) {
    throw invalidFile('file', 'a project-relative path of an .mp4 directly under out/');
  }
  return value;
}

function parseTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : '';
  if (title.length < 1 || title.length > PUBLISH_TITLE_MAX_LENGTH) {
    throw invalid('title', `a string of 1 to ${String(PUBLISH_TITLE_MAX_LENGTH)} characters`);
  }
  return title;
}

function parseDescription(value: unknown): string {
  if (typeof value !== 'string' || value.length > PUBLISH_DESCRIPTION_MAX_LENGTH) {
    throw invalid('description', `a string of at most ${String(PUBLISH_DESCRIPTION_MAX_LENGTH)} characters`);
  }
  return value;
}

function parseTags(value: unknown): readonly string[] {
  const expected = `an array of non-empty strings totalling at most ${String(PUBLISH_TAGS_MAX_TOTAL_LENGTH)} characters`;
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string' || tag.trim() === '')) {
    throw invalid('tags', expected);
  }
  const tags = (value as string[]).map((tag) => tag.trim());
  if (tags.reduce((total, tag) => total + tag.length, 0) > PUBLISH_TAGS_MAX_TOTAL_LENGTH) {
    throw invalid('tags', expected);
  }
  return tags;
}

function parsePrivacy(value: unknown): PublishPrivacy {
  if (typeof value !== 'string' || !(PUBLISH_PRIVACIES as readonly string[]).includes(value)) {
    throw invalid('privacy', PUBLISH_PRIVACIES.join(', '));
  }
  return value as PublishPrivacy;
}

function parsePublishAt(value: unknown, nowMs: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsedMs = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(parsedMs) || parsedMs <= nowMs) {
    throw invalid('publishAt', 'an ISO date-time in the future');
  }
  return new Date(parsedMs).toISOString();
}

function parseOptionalText(value: unknown, resource: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalid(resource, 'a non-empty string');
  }
  return value.trim();
}

function parsePlaylistIds(single: unknown, many: unknown): readonly string[] {
  const first = parseOptionalText(single, 'playlistId');
  if (many !== undefined && (!Array.isArray(many) || many.some((id) => typeof id !== 'string' || id.trim() === ''))) {
    throw invalid('playlistIds', 'an array of non-empty strings');
  }
  const ids = [...(first === null ? [] : [first]), ...((many as string[] | undefined) ?? []).map((id) => id.trim())];
  return [...new Set(ids)];
}

function parseThumbnail(value: unknown): string | null {
  const thumbnail = parseOptionalText(value, 'thumbnail');
  if (thumbnail !== null && thumbnailContentType(thumbnail) === null) {
    throw invalidFile('thumbnail', 'a project-relative .png, .jpg or .jpeg path');
  }
  return thumbnail;
}

function parseIgnoreReview(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw invalid('ignoreReview', 'a boolean');
  }
  return value;
}

function parseMadeForKids(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw invalid('madeForKids', 'a boolean');
  }
  return value;
}

export function thumbnailContentType(path: string): string | null {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? null : (THUMBNAIL_EXTENSIONS[path.slice(dot).toLowerCase()] ?? null);
}

export function parsePublishJobInput(body: Readonly<Record<string, unknown>>, nowMs: number): PublishJobInput {
  return {
    platform: parsePlatform(body.platform),
    file: parsePublishFile(body.file),
    title: parseTitle(body.title),
    description: parseDescription(body.description ?? ''),
    tags: parseTags(body.tags ?? []),
    privacy: parsePrivacy(body.privacy),
    publishAt: parsePublishAt(body.publishAt, nowMs),
    playlistIds: parsePlaylistIds(body.playlistId, body.playlistIds),
    thumbnail: parseThumbnail(body.thumbnail),
    categoryId: parseOptionalText(body.categoryId, 'categoryId') ?? YOUTUBE_DEFAULT_CATEGORY_ID,
    madeForKids: parseMadeForKids(body.madeForKids),
    defaultLanguage: parseOptionalText(body.defaultLanguage, 'defaultLanguage'),
    ignoreReview: parseIgnoreReview(body.ignoreReview),
  };
}
