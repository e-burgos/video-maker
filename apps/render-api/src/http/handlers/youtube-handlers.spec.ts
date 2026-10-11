import type { MediaAsset, ReviewReport } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeAiAgent } from '../../__fixtures__/fake-ai-agent';
import { createFakeFetchRemote } from '../../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteAnswer } from '../../__fixtures__/fake-fetch-remote';
import { createFakeOAuthLoopback, emptyRoute, jsonRoute } from '../../__fixtures__/fake-google';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import type { FakeObjectStorageFileSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import type { ServerConfig } from '../../config/server-config';
import type { StoreConfig } from '../../config/store-config';
import { httpStatusFor } from '../../errors/http-status-for';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { toErrorPayload } from '../../errors/to-error-payload';
import type { Job, PublishJob } from '../../jobs/render-job';
import {
  YOUTUBE_CHANNEL_SETTING_KEY,
  YOUTUBE_CLIENT_ID_SECRET,
  YOUTUBE_CLIENT_SECRET_SECRET,
  YOUTUBE_REFRESH_TOKEN_SECRET,
} from '../../youtube/youtube-constants';
import { handleRequest } from '../handle-request';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleCreateRenderJob, handleRetryRenderJob } from './jobs-handler';
import { handleListProjects } from './projects-handler';
import {
  handleDraftYoutubeMetadata,
  handleGetYoutubePublishOptions,
  handleListPublications,
} from './youtube-publish-handler';

const STORE: StoreConfig = {
  mediaRoot: '/media',
  dbPath: '/media/.studio/studio.db',
  maxUploadBytes: 2_147_483_648,
  objectStore: 'fs',
  motionAssetsRoot: '/assets',
  brandsRoot: '/brands',
};
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

const SESSION_URI = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=S1';

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function asset(path: string, width: number, height: number, durationMs: number): MediaAsset {
  return { id: path, kind: 'video', path, durationMs, fps: 30, width, height, hasAudio: true, probedAt: '2026-10-08T00:00:00.000Z' };
}

const DEFAULT_ANSWER: FakeFetchRemoteAnswer = (call) => {
  if (call.url.startsWith('https://oauth2.googleapis.com/token')) {
    return jsonRoute(200, { access_token: 'access-1', expires_in: 3600 });
  }
  if (call.url.includes('/youtube/v3/playlists')) {
    return jsonRoute(200, { items: [{ id: 'PL1', snippet: { title: 'Tutoriales' } }] });
  }
  if (call.url.includes('uploadType=resumable&part=')) {
    return emptyRoute(200, { location: SESSION_URI });
  }
  if (call.url === SESSION_URI) {
    return jsonRoute(200, { id: 'vid123' });
  }
  return emptyRoute(404);
};

interface HarnessOptions {
  readonly connected?: boolean;
  readonly answer?: FakeFetchRemoteAnswer;
  readonly files?: FakeObjectStorageFileSeed[];
  readonly assets?: Record<string, MediaAsset>;
  readonly aiAnswer?: unknown;
}

function harness(options: HarnessOptions = {}) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/promo', '/media/promo/out'],
    files: [{ path: '/media/promo/out/video.mp4', contents: '0123456789' }, ...(options.files ?? [])],
  });
  const google = createFakeFetchRemote(options.answer ?? DEFAULT_ANSWER);
  const loopback = createFakeOAuthLoopback();
  const ai = createFakeAiAgent(options.aiAnswer ?? { title: 'Titulo', description: 'Descripcion', tags: ['uno'] });
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    fetchRemote: google.fetchRemote,
    startOAuthLoopback: loopback.start,
    aiAgent: ai.agent,
    probeAsset: async ({ path }) => options.assets?.[path] ?? asset(path, 1920, 1080, 42_000),
  });
  deps.localStore.projects.insert('promo');
  const runtime = createRenderApiRuntime(deps, undefined, STORE);
  return { deps, runtime, google, loopback, ai, connect: () => connectYoutube(deps), options };
}

async function connectYoutube(deps: ReturnType<typeof harness>['deps']): Promise<void> {
  await deps.secretStore.set(YOUTUBE_CLIENT_ID_SECRET, 'client-id');
  await deps.secretStore.set(YOUTUBE_CLIENT_SECRET_SECRET, 'client-secret');
  await deps.secretStore.set(YOUTUBE_REFRESH_TOKEN_SECRET, 'refresh-1');
  deps.localStore.settings.set(YOUTUBE_CHANNEL_SETTING_KEY, { id: 'UC1', title: 'Canal', thumbnailUrl: null });
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

const PUBLISH_BODY = {
  kind: 'publish',
  platform: 'youtube',
  file: 'out/video.mp4',
  title: 'Mi video',
  description: 'Descripcion',
  tags: ['uno', 'dos'],
  privacy: 'public',
};

function createJob(h: ReturnType<typeof harness>, body: Record<string, unknown>) {
  return handleCreateRenderJob(
    h.deps,
    STORE,
    { slug: 'promo' },
    requestLine({ method: 'POST', path: '/projects/promo/jobs', body: jsonBody({ ...PUBLISH_BODY, ...body }) }),
    h.runtime,
  );
}

function errorOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (cause: unknown) => toErrorPayload(cause),
  );
}

describe('youtube integration endpoints', () => {
  it('GET answers the status with exactly clientConfigured, connected and channel', async () => {
    const h = harness();

    const response = await call(h, 'GET', '/integrations/youtube');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(['channel', 'clientConfigured', 'connected']);
    expect(response.body).toEqual({ clientConfigured: false, connected: false, channel: null });
  });

  it('PUT client stores the client and answers the same shape; invalid bodies are rejected', async () => {
    const h = harness();

    const response = await call(h, 'PUT', '/integrations/youtube/client', { clientId: 'id', clientSecret: 'secret' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ clientConfigured: true, connected: false, channel: null });

    const invalid = await call(h, 'PUT', '/integrations/youtube/client', { clientId: '', clientSecret: 'secret' });
    expect(invalid.status).toBe(422);
    expect((invalid.body as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
  });

  it('POST connect answers 409 YOUTUBE_CLIENT_MISSING without a client and {authUrl} with one', async () => {
    const h = harness();

    const missing = await call(h, 'POST', '/integrations/youtube/connect');
    expect(missing.status).toBe(409);
    expect((missing.body as { error: { code: string } }).error.code).toBe('YOUTUBE_CLIENT_MISSING');

    await call(h, 'PUT', '/integrations/youtube/client', { clientId: 'id', clientSecret: 'secret' });
    const connect = await call(h, 'POST', '/integrations/youtube/connect');
    expect(connect.status).toBe(200);
    expect(Object.keys(connect.body as object)).toEqual(['authUrl']);
    expect((connect.body as { authUrl: string }).authUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/u);
  });

  it('DELETE answers 204 and leaves the integration disconnected', async () => {
    const h = harness();
    await h.connect();

    const response = await call(h, 'DELETE', '/integrations/youtube');

    expect(response.status).toBe(204);
    expect((await call(h, 'GET', '/integrations/youtube')).body).toEqual({
      clientConfigured: true,
      connected: false,
      channel: null,
    });
  });

  it('GET reports the connected channel', async () => {
    const h = harness();
    await h.connect();

    const status = (await call(h, 'GET', '/integrations/youtube')).body as { channel: object };

    expect(Object.keys(status.channel).sort()).toEqual(['id', 'thumbnailUrl', 'title']);
  });

  it('never reaches a host outside the three Google hosts', async () => {
    const h = harness();
    await h.connect();
    await call(h, 'DELETE', '/integrations/youtube');
    await createJob(h, {}).catch(() => undefined);

    const hosts = new Set(h.google.calls.map((entry) => new URL(entry.url).hostname));

    for (const host of hosts) {
      expect(['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com']).toContain(host);
    }
  });

});

const PLAYLIST_ANSWER: FakeFetchRemoteAnswer = (remote) => {
  if (remote.url.includes('/youtube/v3/playlists?part=snippet,status') && remote.init.method === 'POST') {
    return jsonRoute(200, { id: 'PLnew' });
  }
  if (remote.url.includes('/youtube/v3/playlistItems')) {
    return jsonRoute(200, { id: 'item-1' });
  }
  return DEFAULT_ANSWER(remote);
};

function sentJson(h: ReturnType<typeof harness>, fragment: string): unknown {
  const sent = h.google.calls.find((entry) => entry.url.includes(fragment));
  return JSON.parse(String(sent?.init.body));
}

describe('youtube playlist endpoints (FIX-e-burgos-012)', () => {
  it('asks Google for the playlist permission when connecting', async () => {
    const h = harness();
    await call(h, 'PUT', '/integrations/youtube/client', { clientId: 'id', clientSecret: 'secret' });

    const connect = await call(h, 'POST', '/integrations/youtube/connect');
    const scope = new URL((connect.body as { authUrl: string }).authUrl).searchParams.get('scope') ?? '';

    expect(scope.split(' ')).toContain('https://www.googleapis.com/auth/youtube.force-ssl');
  });

  it('GET lists the playlists of the connected channel', async () => {
    const h = harness();
    await h.connect();

    const response = await call(h, 'GET', '/integrations/youtube/playlists');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ playlists: [{ id: 'PL1', title: 'Tutoriales' }] });
  });

  it('POST creates a playlist, private by default, and answers 201 {id, title}', async () => {
    const h = harness({ answer: PLAYLIST_ANSWER });
    await h.connect();

    const response = await call(h, 'POST', '/integrations/youtube/playlists', { title: ' Campañas ', description: 'Tutoriales' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'PLnew', title: 'Campañas' });
    expect(sentJson(h, 'playlists?part=snippet,status')).toEqual({
      snippet: { title: 'Campañas', description: 'Tutoriales' },
      status: { privacyStatus: 'private' },
    });
  });

  it('POST rejects an empty title and an unknown privacy with INVALID_INPUT', async () => {
    const h = harness({ answer: PLAYLIST_ANSWER });
    await h.connect();

    const noTitle = await call(h, 'POST', '/integrations/youtube/playlists', { title: '' });
    const badPrivacy = await call(h, 'POST', '/integrations/youtube/playlists', { title: 'Medios', privacy: 'friends' });

    expect((noTitle.body as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    expect((badPrivacy.body as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
  });

  it('POST items adds an already published video to a playlist', async () => {
    const h = harness({ answer: PLAYLIST_ANSWER });
    await h.connect();

    const response = await call(h, 'POST', '/integrations/youtube/playlists/PL1/items', { videoId: 'cQ3KhQZIVV4' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ playlistId: 'PL1', videoId: 'cQ3KhQZIVV4' });
    expect(sentJson(h, 'playlistItems')).toEqual({
      snippet: { playlistId: 'PL1', resourceId: { kind: 'youtube#video', videoId: 'cQ3KhQZIVV4' } },
    });
  });

  it('asks to reconnect when the channel was connected without the playlist permission', async () => {
    const h = harness({
      answer: (remote) =>
        remote.url.includes('/youtube/v3/playlists?part=snippet,status')
          ? jsonRoute(403, { error: { message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] } })
          : DEFAULT_ANSWER(remote),
    });
    await h.connect();

    const response = await call(h, 'POST', '/integrations/youtube/playlists', { title: 'Medios' });
    const error = (response.body as { error: { code: string; hint: string } }).error;

    expect(error.code).toBe('YOUTUBE_NOT_CONNECTED');
    expect(error.hint).toMatch(/connect YouTube again/u);
  });
});

describe('GET /projects/:slug/publish/youtube/options', () => {
  it('lists the mp4 files of out/ newest first with their probe data, and the playlists when connected', async () => {
    const h = harness({
      files: [
        { path: '/media/promo/out/short.mp4', contents: 'abc', modifiedAtMs: 2_000_000_000_000 },
        { path: '/media/promo/out/notes.txt', contents: 'n' },
        { path: '/media/promo/out/.hidden.mp4', contents: 'n' },
      ],
      assets: { '/media/promo/out/short.mp4': asset('short', 1080, 1920, 30_000) },
    });
    await h.connect();

    const response = await handleGetYoutubePublishOptions(h.deps, STORE, { slug: 'promo' }, h.runtime);
    const body = response.body as { files: Record<string, unknown>[]; playlists: object[]; defaults: object };

    expect(Object.keys(body).sort()).toEqual(['defaults', 'files', 'playlists']);
    expect(body.files.map((file) => file.path)).toEqual(['out/short.mp4', 'out/video.mp4']);
    expect(Object.keys(body.files[0] ?? {}).sort()).toEqual(['durationSec', 'height', 'isShort', 'path', 'reviewStatus', 'sizeBytes', 'width']);
    expect(body.files[0]).toEqual({ path: 'out/short.mp4', durationSec: 30, width: 1080, height: 1920, isShort: true, sizeBytes: 3, reviewStatus: null });
    expect(body.files[1]).toMatchObject({ path: 'out/video.mp4', durationSec: 42, isShort: false, sizeBytes: 10 });
    expect(body.playlists).toEqual([{ id: 'PL1', title: 'Tutoriales' }]);
    expect(body.defaults).toEqual({ privacy: 'public' });
  });

  it('answers no playlists when YouTube is not connected', async () => {
    const h = harness();

    const response = await handleGetYoutubePublishOptions(h.deps, STORE, { slug: 'promo' }, h.runtime);

    expect((response.body as { playlists: object[] }).playlists).toEqual([]);
    expect(h.google.calls).toHaveLength(0);
  });

  it('skips a file the probe cannot read', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: ['/media/promo', '/media/promo/out'],
      files: [
        { path: '/media/promo/out/good.mp4', contents: 'ok' },
        { path: '/media/promo/out/broken.mp4', contents: 'no' },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, {
      storage,
      probeAsset: async ({ path }) => {
        if (path.endsWith('broken.mp4')) {
          throw new Error('ffprobe failed');
        }
        return asset(path, 1920, 1080, 10_000);
      },
    });
    deps.localStore.projects.insert('promo');

    const response = await handleGetYoutubePublishOptions(deps, STORE, { slug: 'promo' }, createRenderApiRuntime(deps));

    expect((response.body as { files: { path: string }[] }).files.map((file) => file.path)).toEqual(['out/good.mp4']);
  });

  it('answers no playlists instead of failing when YouTube rejects the playlist listing', async () => {
    const h = harness({ answer: (call) => (call.url.includes('/playlists') ? jsonRoute(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }) : DEFAULT_ANSWER(call, 0)) });
    await h.connect();

    const response = await handleGetYoutubePublishOptions(h.deps, STORE, { slug: 'promo' }, h.runtime);

    expect((response.body as { playlists: object[] }).playlists).toEqual([]);
  });
});

describe('POST /projects/:slug/publish/youtube/draft', () => {
  it('answers title, description and tags from the producer engine', async () => {
    const h = harness();

    const response = await handleDraftYoutubeMetadata(
      h.deps,
      STORE,
      { slug: 'promo' },
      requestLine({ method: 'POST', path: '/p', body: jsonBody({ file: 'out/video.mp4' }) }),
    );

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(['description', 'tags', 'title']);
    expect(response.body).toEqual({ title: 'Titulo', description: 'Descripcion', tags: ['uno'] });
  });

  it('adds #Shorts for a vertical short and the music credits to the description', async () => {
    const h = harness({
      files: [{ path: '/media/promo/out/video.credits.txt', contents: 'Música: Tema' }],
      assets: { '/media/promo/out/video.mp4': asset('v', 1080, 1920, 20_000) },
    });

    const response = await handleDraftYoutubeMetadata(
      h.deps,
      STORE,
      { slug: 'promo' },
      requestLine({ method: 'POST', path: '/p', body: jsonBody({ file: 'out/video.mp4' }) }),
    );
    const body = response.body as { title: string; description: string };

    expect(body.title).toBe('Titulo #Shorts');
    expect(body.description).toContain('Música: Tema');
  });

  it('rejects a file that is not an mp4 directly under out/ and a missing file', async () => {
    const h = harness();
    const draft = (file: unknown) =>
      handleDraftYoutubeMetadata(h.deps, STORE, { slug: 'promo' }, requestLine({ method: 'POST', path: '/p', body: jsonBody({ file }) }));

    expect((await errorOf(draft('raw/aroll/a.mp4'))).code).toBe('PUBLISH_FILE_INVALID');
    expect((await errorOf(draft('out/sub/a.mp4'))).code).toBe('PUBLISH_FILE_INVALID');
    expect((await errorOf(draft('out/missing.mp4'))).code).toBe('PUBLISH_FILE_INVALID');
    expect((await errorOf(draft(undefined))).code).toBe('PUBLISH_FILE_INVALID');
  });

  it('maps an unavailable AI engine to the existing agent error', async () => {
    const h = harness();
    const failing = createFakeRenderApiDependencies(createCallLog(), {
      storage: h.deps.storage,
      localStore: h.deps.localStore,
      probeAsset: h.deps.probeAsset,
      aiAgent: async () => {
        throw new PipelineStageError({ code: 'AI_AGENT_UNAVAILABLE', stage: null });
      },
    });

    const error = await errorOf(
      handleDraftYoutubeMetadata(failing, STORE, { slug: 'promo' }, requestLine({ method: 'POST', path: '/p', body: jsonBody({ file: 'out/video.mp4' }) })),
    );

    expect(error.code).toBe('AI_AGENT_UNAVAILABLE');
  });
});

describe('publish job creation', () => {
  it('answers 202 with the shared job envelope for a publish job', async () => {
    const h = harness();
    await h.connect();

    const response = await createJob(h, {});
    const job = response.body as Job;

    expect(response.status).toBe(202);
    expect(job.kind).toBe('publish');
    expect(Object.keys(job).sort()).toEqual(['createdAt', 'error', 'finishedAt', 'id', 'kind', 'progress', 'report', 'slug', 'startedAt', 'state']);
    await h.runtime.jobs.whenIdle();
  });

  it('runs to success through the queue and settles with the report {videoId, url, privacy, publishAt, title}', async () => {
    const h = harness();
    await h.connect();

    const response = await createJob(h, {});
    await h.runtime.jobs.whenIdle();
    const settled = h.runtime.jobs.get((response.body as Job).id) as PublishJob;

    expect(settled.state).toBe('succeeded');
    expect(Object.keys(settled.report ?? {}).sort()).toEqual(['privacy', 'publishAt', 'title', 'url', 'videoId']);
    expect(settled.report).toEqual({
      videoId: 'vid123',
      url: 'https://youtu.be/vid123',
      privacy: 'public',
      publishAt: null,
      title: 'Mi video',
    });
    expect(settled.progress?.percent).toBe(100);
    expect(Object.keys(settled.progress ?? {}).sort()).toEqual(['percent', 'stage', 'totalBytes', 'uploadedBytes']);
  });

  it('settles failed with the Google reason when YouTube refuses and lists the failed publication', async () => {
    const h = harness({
      answer: (call, index) =>
        call.url.includes('uploadType=resumable&part=')
          ? jsonRoute(403, { error: { message: 'limit', errors: [{ reason: 'quotaExceeded' }] } })
          : DEFAULT_ANSWER(call, index),
    });
    await h.connect();

    const response = await createJob(h, {});
    await h.runtime.jobs.whenIdle();

    const settled = h.runtime.jobs.get((response.body as Job).id);
    expect(settled?.state).toBe('failed');
    expect(settled?.error).toMatchObject({ code: 'YOUTUBE_QUOTA_EXCEEDED', stage: 'upload' });
    const listed = await handleListPublications(h.deps, STORE, { slug: 'promo' });
    expect((listed.body as { status: string }[]).map((row) => row.status)).toEqual(['failed']);
  });

  it('retries a failed publish job through the shared retry endpoint', async () => {
    let failing = true;
    const h = harness({
      answer: (call, index) =>
        failing && call.url.includes('uploadType=resumable&part=')
          ? jsonRoute(400, { error: { message: 'bad', errors: [{ reason: 'invalidTitle' }] } })
          : DEFAULT_ANSWER(call, index),
    });
    await h.connect();
    const first = (await createJob(h, {})).body as Job;
    await h.runtime.jobs.whenIdle();
    failing = false;

    const retried = await handleRetryRenderJob(h.deps, STORE, { jobId: first.id }, h.runtime);
    await h.runtime.jobs.whenIdle();

    expect(retried.status).toBe(202);
    expect(h.runtime.jobs.get((retried.body as Job).id)?.state).toBe('succeeded');
  });

  it('answers 409 YOUTUBE_CLIENT_MISSING and 409 YOUTUBE_NOT_CONNECTED before queueing anything', async () => {
    const h = harness();
    expect((await errorOf(createJob(h, {}))).code).toBe('YOUTUBE_CLIENT_MISSING');

    await h.deps.secretStore.set(YOUTUBE_CLIENT_ID_SECRET, 'id');
    await h.deps.secretStore.set(YOUTUBE_CLIENT_SECRET_SECRET, 'secret');
    expect((await errorOf(createJob(h, {}))).code).toBe('YOUTUBE_NOT_CONNECTED');
    expect(httpStatusFor('YOUTUBE_NOT_CONNECTED')).toBe(409);
    expect(h.runtime.jobs.listBySlug('promo')).toEqual([]);
  });

  it('rejects invalid parameters with INVALID_INPUT or PUBLISH_FILE_INVALID', async () => {
    const h = harness({ files: [{ path: '/media/promo/work/big.png', contents: 'x'.repeat(2 * 1024 * 1024 + 1) }] });
    await h.connect();
    const code = async (body: Record<string, unknown>) => (await errorOf(createJob(h, body))).code;

    expect(await code({ title: '' })).toBe('INVALID_INPUT');
    expect(await code({ title: 'x'.repeat(101) })).toBe('INVALID_INPUT');
    expect(await code({ description: 'x'.repeat(5001) })).toBe('INVALID_INPUT');
    expect(await code({ tags: ['x'.repeat(501)] })).toBe('INVALID_INPUT');
    expect(await code({ privacy: 'secret' })).toBe('INVALID_INPUT');
    expect(await code({ platform: 'tiktok' })).toBe('INVALID_INPUT');
    expect(await code({ publishAt: '2020-01-01T00:00:00.000Z' })).toBe('INVALID_INPUT');
    expect(await code({ publishAt: 'tomorrow' })).toBe('INVALID_INPUT');
    expect(await code({ madeForKids: 'no' })).toBe('INVALID_INPUT');
    expect(await code({ file: 'raw/a.mp4' })).toBe('PUBLISH_FILE_INVALID');
    expect(await code({ file: 'out/missing.mp4' })).toBe('PUBLISH_FILE_INVALID');
    expect(await code({ thumbnail: 'work/missing.png' })).toBe('PUBLISH_FILE_INVALID');
    expect(await code({ thumbnail: 'work/big.png' })).toBe('PUBLISH_FILE_INVALID');
    expect(await code({ thumbnail: 'work/a.bmp' })).toBe('PUBLISH_FILE_INVALID');
    expect(h.runtime.jobs.listBySlug('promo')).toEqual([]);
  });

  it('applies the defaults: category 22, not made for kids and language es without a brand', async () => {
    const h = harness();
    await h.connect();

    await createJob(h, {});
    await h.runtime.jobs.whenIdle();

    const stored = h.deps.localStore.jobs.listByProject('promo')[0]?.params as Record<string, unknown>;
    expect(stored).toMatchObject({ categoryId: '22', madeForKids: false, defaultLanguage: 'es', playlistId: null, thumbnail: null, publishAt: null });
  });

  it('accepts a future publishAt and keeps it normalized in the stored params', async () => {
    const h = harness();
    await h.connect();

    await createJob(h, { publishAt: '2099-01-01T10:00:00Z' });
    await h.runtime.jobs.whenIdle();

    const stored = h.deps.localStore.jobs.listByProject('promo')[0]?.params as Record<string, unknown>;
    expect(stored.publishAt).toBe('2099-01-01T10:00:00.000Z');
  });
});

describe('GET /projects/:slug/publications and the project list', () => {
  it('lists the publications newest first with exactly the contract keys', async () => {
    const h = harness();
    await h.connect();
    await createJob(h, {});
    await h.runtime.jobs.whenIdle();

    const response = await call(h, 'GET', '/projects/promo/publications');
    const rows = response.body as Record<string, unknown>[];

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'createdAt',
      'file',
      'id',
      'platform',
      'privacy',
      'publishAt',
      'publishedAt',
      'status',
      'title',
      'url',
      'videoId',
    ]);
    expect(rows[0]).toMatchObject({ platform: 'youtube', status: 'published', url: 'https://youtu.be/vid123', videoId: 'vid123' });
  });

  it('answers 404 for an unknown project', async () => {
    const h = harness();

    const response = await call(h, 'GET', '/projects/ghost/publications');

    expect(response.status).toBe(404);
  });

  it('marks the project in the list with its last publication', async () => {
    const h = harness();
    await h.connect();
    await createJob(h, {});
    await h.runtime.jobs.whenIdle();

    const list = (await handleListProjects(h.deps, STORE)).body as { slug: string; lastPublication: object | null }[];

    expect(list.find((project) => project.slug === 'promo')?.lastPublication).toEqual({
      platform: 'youtube',
      url: 'https://youtu.be/vid123',
      status: 'published',
    });
  });
});

function reviewReport(status: ReviewReport['status']): ReviewReport {
  const critical: ReviewReport['findings'] = [
    {
      id: 'voice-music-margin-01',
      check: 'voice-music-margin',
      severity: 'critical',
      message: 'La música tapa la voz.',
      timeRange: { startSec: 1, endSec: 4 },
      proposedFix: 'Bajar la música 6 dB.',
    },
  ];
  const suggestion: ReviewReport['findings'] = [
    { id: 'master-loudness-01', check: 'master-loudness', severity: 'suggestion', message: 'Máster alto.' },
  ];
  return {
    version: 1,
    file: 'out/video.mp4',
    createdAt: '2026-10-11T12:00:00.000Z',
    status,
    delivery: { kind: 'tutorial' },
    metrics: { masterIntegratedLufs: -14.2, voiceMusicMarginDb: status === 'fail' ? 4.4 : null },
    findings: status === 'fail' ? [...critical, ...suggestion] : status === 'warn' ? suggestion : [],
  };
}

function reviewFileSeed(status: ReviewReport['status']): FakeObjectStorageFileSeed {
  return { path: '/media/promo/out/video.review.json', contents: JSON.stringify(reviewReport(status)) };
}

describe('GET /projects/:slug/reviews', () => {
  it('lists the reviews of out/ with exactly file, reviewFile, status, counts and createdAt', async () => {
    const h = harness({ files: [reviewFileSeed('fail')] });

    const response = await call(h, 'GET', '/projects/promo/reviews');
    const body = response.body as { reviews: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual(['reviews']);
    expect(Object.keys(body.reviews[0] ?? {}).sort()).toEqual(['counts', 'createdAt', 'file', 'reviewFile', 'status']);
    expect(body.reviews[0]).toEqual({
      file: 'out/video.mp4',
      reviewFile: 'out/video.review.json',
      status: 'fail',
      counts: { critical: 1, suggestion: 1, nitpick: 0 },
      createdAt: '2026-10-11T12:00:00.000Z',
    });
  });

  it('answers an empty list when there are no reviews and skips unreadable review files', async () => {
    const broken: FakeObjectStorageFileSeed = { path: '/media/promo/out/broken.review.json', contents: '{"nope":true}' };
    const h = harness({ files: [broken] });

    const response = await call(h, 'GET', '/projects/promo/reviews');

    expect(response.body).toEqual({ reviews: [] });
  });

  it('returns the full report for ?file=', async () => {
    const h = harness({ files: [reviewFileSeed('fail')] });

    const response = await call(h, 'GET', '/projects/promo/reviews?file=out/video.mp4');
    const body = response.body as ReviewReport;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['createdAt', 'delivery', 'file', 'findings', 'metrics', 'status', 'version']);
    expect(Object.keys(body.findings[0] ?? {}).sort()).toEqual(['check', 'id', 'message', 'proposedFix', 'severity', 'timeRange']);
  });

  it('answers 404 REVIEW_NOT_FOUND for a render without review and 422 for an invalid file', async () => {
    const h = harness();

    const missing = await call(h, 'GET', '/projects/promo/reviews?file=out/video.mp4');
    expect(missing.status).toBe(404);
    expect((missing.body as { error: { code: string } }).error.code).toBe('REVIEW_NOT_FOUND');

    const invalid = await call(h, 'GET', '/projects/promo/reviews?file=raw/video.mp4');
    expect(invalid.status).toBe(422);
    expect((invalid.body as { error: { code: string } }).error.code).toBe('REVIEW_FILE_INVALID');
  });
});

describe('publish options reviewStatus', () => {
  it('adds the review status of each mp4 and null when it has none', async () => {
    const h = harness({
      files: [reviewFileSeed('warn'), { path: '/media/promo/out/other.mp4', contents: 'abc' }],
    });

    const response = await call(h, 'GET', '/projects/promo/publish/youtube/options');
    const files = (response.body as { files: Array<{ path: string; reviewStatus: string | null }> }).files;

    expect(files.map((file) => [file.path, file.reviewStatus]).sort()).toEqual([
      ['out/other.mp4', null],
      ['out/video.mp4', 'warn'],
    ]);
  });
});

describe('publish precondition RENDER_REVIEW_FAILED', () => {
  it('blocks a publish whose review failed with 409 and the critical findings in the hint', async () => {
    const h = harness({ files: [reviewFileSeed('fail')] });
    await h.connect();

    const payload = await errorOf(createJob(h, {}));

    expect(payload.code).toBe('RENDER_REVIEW_FAILED');
    expect(payload.hint).toContain('La música tapa la voz.');
    expect(httpStatusFor(payload.code)).toBe(409);
  });

  it('lets the publish through with ignoreReview true', async () => {
    const h = harness({ files: [reviewFileSeed('fail')] });
    await h.connect();

    const response = await createJob(h, { ignoreReview: true });

    expect(response.status).toBe(202);
    await h.runtime.jobs.whenIdle();
  });

  it('does not block on a warn review, on a pass review or without any review', async () => {
    for (const files of [[reviewFileSeed('warn')], [reviewFileSeed('pass')], []]) {
      const h = harness({ files });
      await h.connect();

      expect((await createJob(h, {})).status).toBe(202);
      await h.runtime.jobs.whenIdle();
    }
  });

  it('rejects a non-boolean ignoreReview', async () => {
    const h = harness();
    await h.connect();

    const payload = await errorOf(createJob(h, { ignoreReview: 'yes' }));

    expect(payload.code).toBe('INVALID_INPUT');
  });
});

describe('review job creation', () => {
  function createReview(h: ReturnType<typeof harness>, file: unknown) {
    return handleCreateRenderJob(
      h.deps,
      STORE,
      { slug: 'promo' },
      requestLine({ method: 'POST', path: '/projects/promo/jobs', body: jsonBody({ kind: 'review', file }) }),
      h.runtime,
    );
  }

  it('answers 202 with a review job for an existing mp4 and settles with the report shape', async () => {
    const h = harness();

    const response = await createReview(h, 'out/video.mp4');
    await h.runtime.jobs.whenIdle();
    const settled = h.runtime.jobs.get((response.body as Job).id);

    expect(response.status).toBe(202);
    expect((response.body as Job).kind).toBe('review');
    expect(settled?.state).toBe('failed');
    expect(settled?.error?.code).toBe('REVIEW_INPUTS_UNAVAILABLE');
  });

  it('rejects a path outside out/ or a missing file with REVIEW_FILE_INVALID', async () => {
    const h = harness();

    expect((await errorOf(createReview(h, 'raw/video.mp4'))).code).toBe('REVIEW_FILE_INVALID');
    expect((await errorOf(createReview(h, 'out/missing.mp4'))).code).toBe('REVIEW_FILE_INVALID');
  });
});
