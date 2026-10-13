import type { PublishQueueMetadata, PublishQueueRecord } from '@video-maker/local-store';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { parsePublishJobInput } from '../../jobs/publish-job-params';
import type { PublishJobInput } from '../../jobs/publish-job-params';
import { sampleFileClassifierFor } from '../../jobs/sample-files';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { assertPublishableVideo } from '../../youtube/publish-preconditions';
import { countPublishedInLastDay, findExistingPublication } from '../../youtube/publish-queue-scheduler';
import {
  MAX_DAILY_PUBLISH_LIMIT,
  MIN_DAILY_PUBLISH_LIMIT,
  readCategoryPlaylistSettings,
  readPublishQueueSettings,
  writeCategoryPlaylistSettings,
  writePublishQueueSettings,
} from '../../youtube/publish-queue-settings';
import type { CategoryPlaylistSettings, PublishQueueSettings } from '../../youtube/publish-queue-settings';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';
import { listPublishFiles } from './youtube-publish-handler';

export interface PublishQueueItemBody {
  readonly id: string;
  readonly slug: string;
  readonly file: string;
  readonly metadata: PublishQueueMetadata;
  readonly position: number;
  readonly status: string;
  readonly attempts: number;
  readonly lastError: unknown | null;
  readonly nextAttemptAt: string | null;
  readonly jobId: string | null;
  readonly url: string | null;
}

export interface PublishQueueBody {
  readonly settings: PublishQueueSettings;
  readonly publishedLast24h: number;
  readonly nextAttemptAt: string | null;
  readonly items: readonly PublishQueueItemBody[];
}

export interface CreatePublishQueueItemBody {
  readonly item: PublishQueueItemBody;
  readonly alreadyPublished: { readonly url: string | null } | null;
}

const METADATA_PATCH_KEYS = [
  'title',
  'description',
  'tags',
  'privacy',
  'publishAt',
  'playlistIds',
  'thumbnail',
  'categoryId',
  'madeForKids',
  'defaultLanguage',
  'ignoreReview',
] as const;

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalid(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function toItemBody(record: PublishQueueRecord): PublishQueueItemBody {
  return {
    id: record.id,
    slug: record.slug,
    file: record.file,
    metadata: record.metadata,
    position: record.position,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    nextAttemptAt: record.nextAttemptAt,
    jobId: record.jobId,
    url: record.url,
  };
}

function requireItem(deps: RenderApiDependencies, itemId: string): PublishQueueRecord {
  const item = deps.localStore.publishQueue.get(itemId);
  if (item === null) {
    throw new PipelineStageError({ code: 'PUBLISH_QUEUE_ITEM_NOT_FOUND', stage: null, resource: itemId });
  }
  return item;
}

function requireIdle(item: PublishQueueRecord): void {
  if (item.status === 'publishing') {
    throw new PipelineStageError({ code: 'PUBLISH_QUEUE_ITEM_BUSY', stage: null, resource: item.id });
  }
}

function buildMetadata(raw: Readonly<Record<string, unknown>>, input: PublishJobInput): PublishQueueMetadata {
  return {
    title: input.title,
    description: input.description,
    tags: input.tags,
    privacy: input.privacy,
    ...(input.publishAt === null ? {} : { publishAt: input.publishAt }),
    ...(input.playlistIds.length === 0 ? {} : { playlistIds: input.playlistIds }),
    ...(input.thumbnail === null ? {} : { thumbnail: input.thumbnail }),
    ...(raw.categoryId === undefined || raw.categoryId === null ? {} : { categoryId: input.categoryId }),
    ...(raw.madeForKids === undefined ? {} : { madeForKids: input.madeForKids }),
    ...(input.defaultLanguage === null ? {} : { defaultLanguage: input.defaultLanguage }),
    ...(raw.ignoreReview === undefined ? {} : { ignoreReview: input.ignoreReview }),
  };
}

function validateMetadata(
  raw: Readonly<Record<string, unknown>>,
  file: string,
  nowIso: string,
): PublishQueueMetadata {
  const input = parsePublishJobInput({ ...raw, platform: 'youtube', file }, Date.parse(nowIso));
  return buildMetadata(raw, input);
}

export function handleGetPublishQueue(deps: RenderApiDependencies): HttpResponse {
  const queue = deps.localStore.publishQueue;
  const body: PublishQueueBody = {
    settings: readPublishQueueSettings(deps.localStore.settings),
    publishedLast24h: countPublishedInLastDay(deps.localStore.publications, Date.parse(deps.clock.nowIso())),
    nextAttemptAt: queue.earliestNextAttemptAt(),
    items: queue.list().map(toItemBody),
  };
  return jsonResponse(200, body);
}

async function resolveDefaultFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
  slug: string,
): Promise<string> {
  const project = await resolveExistingProject(deps, store, slug);
  const [latest] = await listPublishFiles(deps, project, sampleFileClassifierFor(runtime.jobs, slug));
  if (latest === undefined) {
    throw new PipelineStageError({
      code: 'PUBLISH_FILE_INVALID',
      stage: null,
      resource: slug,
      expected: 'a delivered .mp4 under out/ that is not a sample',
    });
  }
  return latest.path;
}

export async function handleCreatePublishQueueItem(
  deps: RenderApiDependencies,
  store: StoreConfig,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const slug = typeof body.slug === 'string' ? body.slug : '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);
  const requestedFile = body.file === undefined ? await resolveDefaultFile(deps, store, runtime, slug) : body.file;
  const input = parsePublishJobInput({ ...body, platform: 'youtube', file: requestedFile }, Date.parse(deps.clock.nowIso()));
  await assertPublishableVideo(deps.storage, project, input.file, sampleFileClassifierFor(runtime.jobs, slug));

  const record = deps.localStore.publishQueue.insert({
    id: deps.randomId(),
    slug,
    file: input.file,
    metadata: buildMetadata(body, input),
    createdAt: deps.clock.nowIso(),
  });
  void runtime.publishQueue.poke();

  const existing = findExistingPublication(deps.localStore.publications, slug, input.file);
  const response: CreatePublishQueueItemBody = {
    item: toItemBody(record),
    alreadyPublished: existing === null ? null : { url: existing.url },
  };
  return jsonResponse(201, response);
}

function parsePosition(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw invalid('position', 'a non-negative integer');
  }
  return value;
}

function parseMetadataPatch(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid('metadata', 'an object with the publish metadata fields to change');
  }
  const patch = value as Record<string, unknown>;
  const unknownKey = Object.keys(patch).find((key) => !(METADATA_PATCH_KEYS as readonly string[]).includes(key));
  if (unknownKey !== undefined) {
    throw invalid(`metadata.${unknownKey}`, `one of ${METADATA_PATCH_KEYS.join(', ')}`);
  }
  return patch;
}

function assertRetryable(item: PublishQueueRecord): void {
  if (item.status !== 'failed') {
    throw invalid('status', "'queued' is only accepted on an item in the failed status");
  }
}

export async function handleUpdatePublishQueueItem(
  deps: RenderApiDependencies,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const queue = deps.localStore.publishQueue;
  const item = requireItem(deps, params.itemId ?? '');
  requireIdle(item);
  const body = await readJsonObjectBody(request);

  if (body.status !== undefined && body.status !== 'queued') {
    throw invalid('status', "'queued'");
  }
  const metadata =
    body.metadata === undefined
      ? undefined
      : validateMetadata({ ...item.metadata, ...parseMetadataPatch(body.metadata) }, item.file, deps.clock.nowIso());
  if (body.status === 'queued') {
    assertRetryable(item);
  }
  const position = body.position === undefined ? undefined : parsePosition(body.position);

  const updatedAt = deps.clock.nowIso();
  if (metadata !== undefined) {
    queue.update(item.id, { metadata, updatedAt });
  }
  if (body.status === 'queued') {
    queue.update(item.id, { status: 'queued', attempts: 0, lastError: null, nextAttemptAt: null, jobId: null, updatedAt });
  }
  if (position !== undefined) {
    queue.move(item.id, position);
  }
  void runtime.publishQueue.poke();

  return jsonResponse(200, toItemBody(requireItem(deps, item.id)));
}

export async function handleDeletePublishQueueItem(
  deps: RenderApiDependencies,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const item = requireItem(deps, params.itemId ?? '');
  requireIdle(item);
  deps.localStore.publishQueue.remove(item.id);
  void runtime.publishQueue.poke();
  return { status: 204, headers: {}, body: undefined };
}

export async function handlePutPublishQueueSettings(
  deps: RenderApiDependencies,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const current = readPublishQueueSettings(deps.localStore.settings);

  if (body.paused !== undefined && typeof body.paused !== 'boolean') {
    throw invalid('paused', 'a boolean');
  }
  const limit = body.dailyLimit;
  if (
    limit !== undefined &&
    (typeof limit !== 'number' || !Number.isInteger(limit) || limit < MIN_DAILY_PUBLISH_LIMIT || limit > MAX_DAILY_PUBLISH_LIMIT)
  ) {
    throw invalid('dailyLimit', `an integer from ${String(MIN_DAILY_PUBLISH_LIMIT)} to ${String(MAX_DAILY_PUBLISH_LIMIT)}`);
  }

  const next: PublishQueueSettings = {
    paused: body.paused ?? current.paused,
    dailyLimit: (limit as number | undefined) ?? current.dailyLimit,
  };
  writePublishQueueSettings(deps.localStore.settings, next);
  void runtime.publishQueue.poke();
  return jsonResponse(200, next);
}

export function handleGetCategoryPlaylists(deps: RenderApiDependencies): HttpResponse {
  return jsonResponse(200, readCategoryPlaylistSettings(deps.localStore.settings));
}

function parseCategoryPlaylists(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid('categoryPlaylists', 'an object mapping category ids to playlist ids');
  }
  const result: Record<string, string> = {};
  for (const [categoryId, playlistId] of Object.entries(value)) {
    if (playlistId === null) {
      continue;
    }
    if (typeof playlistId !== 'string' || playlistId.trim() === '') {
      throw invalid(`categoryPlaylists.${categoryId}`, 'a non-empty playlist id or null');
    }
    result[categoryId] = playlistId.trim();
  }
  return result;
}

function parseGeneralPlaylistId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalid('generalPlaylistId', 'a non-empty playlist id or null');
  }
  return value.trim();
}

export async function handlePutCategoryPlaylists(
  deps: RenderApiDependencies,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const next: CategoryPlaylistSettings = {
    categoryPlaylists: parseCategoryPlaylists(body.categoryPlaylists ?? {}),
    generalPlaylistId: parseGeneralPlaylistId(body.generalPlaylistId),
  };
  writeCategoryPlaylistSettings(deps.localStore.settings, next);
  return jsonResponse(200, next);
}
