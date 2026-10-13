import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { ServerConfig } from '../../config/server-config';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { handleRequest } from '../handle-request';
import { createRenderApiRuntime } from '../render-api-runtime';
import type { CreatePublishQueueItemBody, PublishQueueBody, PublishQueueItemBody } from './publish-queue-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const ITEM_KEYS = ['attempts', 'file', 'id', 'jobId', 'lastError', 'metadata', 'nextAttemptAt', 'position', 'slug', 'status', 'url'];

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function harness() {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/promo', '/media/promo/out'],
    files: [
      { path: '/media/promo/out/video.mp4', contents: '0123456789' },
      { path: '/media/promo/out/second.mp4', contents: '0123456789' },
    ],
  });
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    probeAsset: async ({ path }): Promise<MediaAsset> => ({
      id: path,
      kind: 'video',
      path,
      durationMs: 42_000,
      fps: 30,
      width: 1920,
      height: 1080,
      hasAudio: true,
      probedAt: '2026-10-08T00:00:00.000Z',
    }),
  });
  deps.localStore.projects.insert('promo');
  const runtime = createRenderApiRuntime(deps, undefined, STORE);
  return { deps, runtime };
}

function call(h: ReturnType<typeof harness>, method: string, path: string, body?: unknown) {
  return handleRequest(
    requestLine({ method, path, ...(body === undefined ? {} : { body: jsonBody(body) }) }),
    h.deps,
    STORE,
    h.runtime,
    CONFIG,
  );
}

async function errorOf(promise: Promise<{ status: number; body: unknown }>) {
  const response = await promise;
  expect(response.status).toBeGreaterThanOrEqual(400);
  return (response.body as { error: { code: string } }).error;
}

const ITEM = { slug: 'promo', file: 'out/video.mp4', title: 'Mi video', description: 'D', tags: ['uno'], privacy: 'public' };

async function addItem(h: ReturnType<typeof harness>, overrides: Record<string, unknown> = {}): Promise<PublishQueueItemBody> {
  const response = await call(h, 'POST', '/publish-queue/items', { ...ITEM, ...overrides });
  return (response.body as CreatePublishQueueItemBody).item;
}

describe('publish queue endpoints', () => {
  it('GET answers settings (born paused), counters and items with the contract keys', async () => {
    const h = harness();
    await addItem(h);

    const response = await call(h, 'GET', '/publish-queue');

    const body = response.body as PublishQueueBody;
    expect(Object.keys(body).sort()).toEqual(['items', 'nextAttemptAt', 'publishedLast24h', 'settings']);
    expect(body.settings).toEqual({ paused: true, dailyLimit: 10 });
    expect(body.publishedLast24h).toBe(0);
    expect(body.nextAttemptAt).toBeNull();
    expect(Object.keys(body.items[0] as object).sort()).toEqual(ITEM_KEYS);
  });

  it('POST enqueues at the end as queued and answers item plus alreadyPublished', async () => {
    const h = harness();

    const response = await call(h, 'POST', '/publish-queue/items', ITEM);

    expect(response.status).toBe(201);
    const body = response.body as CreatePublishQueueItemBody;
    expect(Object.keys(body).sort()).toEqual(['alreadyPublished', 'item']);
    expect(body.alreadyPublished).toBeNull();
    expect(Object.keys(body.item).sort()).toEqual(ITEM_KEYS);
    expect(body.item).toMatchObject({
      slug: 'promo',
      file: 'out/video.mp4',
      status: 'queued',
      position: 0,
      attempts: 0,
      metadata: { title: 'Mi video', description: 'D', tags: ['uno'], privacy: 'public' },
    });
  });

  it('POST defaults the file to the latest deliverable and keeps only the given optional metadata', async () => {
    const h = harness();

    const withoutFile = { slug: ITEM.slug, title: ITEM.title, description: ITEM.description, tags: ITEM.tags, privacy: ITEM.privacy };
    const response = await call(h, 'POST', '/publish-queue/items', {
      ...withoutFile,
      playlistIds: ['PL1', 'PL2'],
      categoryId: '27',
    });

    const item = (response.body as CreatePublishQueueItemBody).item;
    expect(item.file).toMatch(/^out\/(video|second)\.mp4$/u);
    expect(item.metadata).toEqual({
      title: 'Mi video',
      description: 'D',
      tags: ['uno'],
      privacy: 'public',
      playlistIds: ['PL1', 'PL2'],
      categoryId: '27',
    });
  });

  it('POST reports a file that is already published or scheduled', async () => {
    const h = harness();
    h.deps.localStore.publications.insert({
      id: 'pub',
      slug: 'promo',
      platform: 'youtube',
      file: 'out/video.mp4',
      title: 'x',
      privacy: 'public',
      status: 'published',
      publishAt: null,
      jobId: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    h.deps.localStore.publications.update('pub', { status: 'published', url: 'https://youtu.be/abc' });

    const response = await call(h, 'POST', '/publish-queue/items', ITEM);

    expect((response.body as CreatePublishQueueItemBody).alreadyPublished).toEqual({ url: 'https://youtu.be/abc' });
  });

  it('POST rejects invalid metadata, unknown projects and missing files', async () => {
    const h = harness();
    const code = async (body: Record<string, unknown>) => (await errorOf(call(h, 'POST', '/publish-queue/items', body))).code;

    expect(await code({ ...ITEM, title: '' })).toBe('INVALID_INPUT');
    expect(await code({ ...ITEM, privacy: 'secret' })).toBe('INVALID_INPUT');
    expect(await code({ ...ITEM, playlistIds: 'PL1' })).toBe('INVALID_INPUT');
    expect(await code({ ...ITEM, slug: 'missing' })).toBe('PROJECT_NOT_FOUND');
    expect(await code({ ...ITEM, file: 'out/none.mp4' })).toBe('PUBLISH_FILE_INVALID');
    expect(await code({ ...ITEM, file: 'raw/a.mp4' })).toBe('PUBLISH_FILE_INVALID');
    expect(h.deps.localStore.publishQueue.list()).toEqual([]);
  });

  it('POST and PATCH accept ignoreReview in the metadata', async () => {
    const h = harness();
    const item = await addItem(h, { ignoreReview: true });
    expect(item.metadata.ignoreReview).toBe(true);

    const patched = await call(h, 'PATCH', `/publish-queue/items/${item.id}`, { metadata: { ignoreReview: false } });

    expect((patched.body as PublishQueueItemBody).metadata.ignoreReview).toBe(false);
  });

  it('PATCH reorders, edits metadata partially and retries a failed item', async () => {
    const h = harness();
    const first = await addItem(h);
    const second = await addItem(h, { file: 'out/second.mp4', title: 'Otro' });

    const moved = await call(h, 'PATCH', `/publish-queue/items/${second.id}`, { position: 0, metadata: { title: 'Nuevo', playlistIds: ['PL9'] } });

    expect(Object.keys(moved.body as object).sort()).toEqual(ITEM_KEYS);
    expect(moved.body).toMatchObject({ position: 0, metadata: { title: 'Nuevo', description: 'D', playlistIds: ['PL9'] } });
    expect(h.deps.localStore.publishQueue.list().map((item) => item.id)).toEqual([second.id, first.id]);

    h.deps.localStore.publishQueue.update(first.id, {
      status: 'failed',
      attempts: 3,
      lastError: { code: 'YOUTUBE_UPLOAD_FAILED' },
      updatedAt: 'x',
    });
    const retried = await call(h, 'PATCH', `/publish-queue/items/${first.id}`, { status: 'queued' });
    expect(retried.body).toMatchObject({ status: 'queued', attempts: 0, lastError: null, nextAttemptAt: null });
  });

  it('PATCH rejects invalid changes and items being published', async () => {
    const h = harness();
    const item = await addItem(h);
    const code = async (id: string, body: Record<string, unknown>) =>
      (await errorOf(call(h, 'PATCH', `/publish-queue/items/${id}`, body))).code;

    expect(await code(item.id, { status: 'queued' })).toBe('INVALID_INPUT');
    expect(await code(item.id, { status: 'failed' })).toBe('INVALID_INPUT');
    expect(await code(item.id, { position: -1 })).toBe('INVALID_INPUT');
    expect(await code(item.id, { metadata: { title: '' } })).toBe('INVALID_INPUT');
    expect(await code(item.id, { metadata: { slug: 'x' } })).toBe('INVALID_INPUT');
    expect(await code('nope', { position: 0 })).toBe('PUBLISH_QUEUE_ITEM_NOT_FOUND');

    h.deps.localStore.publishQueue.update(item.id, { status: 'publishing', updatedAt: 'x' });
    expect(await code(item.id, { position: 0 })).toBe('PUBLISH_QUEUE_ITEM_BUSY');
    expect(httpStatusFor('PUBLISH_QUEUE_ITEM_BUSY')).toBe(409);
    expect(httpStatusFor('PUBLISH_QUEUE_ITEM_NOT_FOUND')).toBe(404);
  });

  it('DELETE removes an idle item and refuses one being published', async () => {
    const h = harness();
    const idle = await addItem(h);
    const busy = await addItem(h, { file: 'out/second.mp4' });
    h.deps.localStore.publishQueue.update(busy.id, { status: 'publishing', updatedAt: 'x' });

    expect((await errorOf(call(h, 'DELETE', `/publish-queue/items/${busy.id}`))).code).toBe('PUBLISH_QUEUE_ITEM_BUSY');
    expect((await call(h, 'DELETE', `/publish-queue/items/${idle.id}`)).status).toBe(204);
    expect((await errorOf(call(h, 'DELETE', `/publish-queue/items/${idle.id}`))).code).toBe('PUBLISH_QUEUE_ITEM_NOT_FOUND');
    expect(h.deps.localStore.publishQueue.list().map((item) => item.id)).toEqual([busy.id]);
  });

  it('PUT settings updates paused and dailyLimit independently and validates them', async () => {
    const h = harness();

    const resumed = await call(h, 'PUT', '/publish-queue/settings', { paused: false });
    expect(resumed.body).toEqual({ paused: false, dailyLimit: 10 });
    const limited = await call(h, 'PUT', '/publish-queue/settings', { dailyLimit: 4 });
    expect(limited.body).toEqual({ paused: false, dailyLimit: 4 });

    const code = async (body: Record<string, unknown>) => (await errorOf(call(h, 'PUT', '/publish-queue/settings', body))).code;
    expect(await code({ dailyLimit: 0 })).toBe('INVALID_INPUT');
    expect(await code({ dailyLimit: 101 })).toBe('INVALID_INPUT');
    expect(await code({ dailyLimit: 2.5 })).toBe('INVALID_INPUT');
    expect(await code({ paused: 'yes' })).toBe('INVALID_INPUT');
  });

  it('GET and PUT category playlists store the mapping and the general playlist', async () => {
    const h = harness();

    const empty = await call(h, 'GET', '/integrations/youtube/category-playlists');
    expect(empty.body).toEqual({ categoryPlaylists: {}, generalPlaylistId: null });

    const saved = await call(h, 'PUT', '/integrations/youtube/category-playlists', {
      categoryPlaylists: { basicos: 'PL1', avanzado: null },
      generalPlaylistId: 'PLG',
    });
    expect(Object.keys(saved.body as object).sort()).toEqual(['categoryPlaylists', 'generalPlaylistId']);
    expect(saved.body).toEqual({ categoryPlaylists: { basicos: 'PL1' }, generalPlaylistId: 'PLG' });
    expect((await call(h, 'GET', '/integrations/youtube/category-playlists')).body).toEqual(saved.body);
    expect((await errorOf(call(h, 'PUT', '/integrations/youtube/category-playlists', { categoryPlaylists: { a: 3 } }))).code).toBe(
      'INVALID_INPUT',
    );
  });
});
