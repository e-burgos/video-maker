import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote } from '../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteCall, FakeFetchRemoteRoute } from '../__fixtures__/fake-fetch-remote';
import { bodyJson, emptyRoute, jsonRoute } from '../__fixtures__/fake-google';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import { createYoutubeClient } from '../youtube/youtube-client';
import type { YoutubeOAuth } from '../youtube/youtube-oauth';
import { PublishPipelineCanceledError } from './publish-pipeline-observer';
import type { PublishPipelineObserver } from './publish-pipeline-observer';
import { runPublishPipeline } from './run-publish-pipeline';
import type { PublishPipelineRequest } from './run-publish-pipeline';

const SESSION_URI = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=SESSION-1';
const VIDEO_BYTES = '0123456789';
const NOW_ISO = '2026-10-08T10:00:00.000Z';
const FUTURE_ISO = '2026-10-20T15:00:00.000Z';

const STUB_OAUTH: YoutubeOAuth = {
  status: async () => ({ clientConfigured: true, connected: true, channel: null }),
  saveClient: async () => ({ clientConfigured: true, connected: true, channel: null }),
  startConnect: async () => ({ authUrl: '' }),
  disconnect: async () => undefined,
  accessToken: async () => 'access-token',
  invalidateAccessToken: () => undefined,
};

interface UploadScript {
  readonly lostResponseAtChunk?: number;
  readonly dropChunk?: number;
  readonly failAlways?: boolean;
  readonly sessionGoneAtChunk?: number;
  readonly initiateResponse?: FakeFetchRemoteRoute;
  readonly thumbnailResponse?: FakeFetchRemoteRoute;
}

function rangeOf(call: FakeFetchRemoteCall): { start: number; end: number; total: number } | 'status' {
  const header = call.init.headers?.['content-range'] ?? '';
  if (header.startsWith('bytes */')) {
    return 'status';
  }
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(header);
  return { start: Number(match?.[1]), end: Number(match?.[2]), total: Number(match?.[3]) };
}

function createFakeYoutubeUpload(script: UploadScript = {}, totalBytes = VIDEO_BYTES.length) {
  let received = 0;
  let chunkIndex = -1;
  const sentBodies: string[] = [];

  const answer = (call: FakeFetchRemoteCall): FakeFetchRemoteRoute | Error => {
    if (call.url.includes('/upload/youtube/v3/videos?uploadType=resumable&part=')) {
      return script.initiateResponse ?? emptyRoute(200, { location: SESSION_URI });
    }
    if (call.url === SESSION_URI) {
      const range = rangeOf(call);
      if (range === 'status') {
        return received >= totalBytes
          ? jsonRoute(200, { id: 'vid123' })
          : received === 0
            ? emptyRoute(308)
            : emptyRoute(308, { range: `bytes=0-${String(received - 1)}` });
      }
      chunkIndex += 1;
      if (script.failAlways === true) {
        return emptyRoute(503);
      }
      if (script.sessionGoneAtChunk === chunkIndex) {
        return emptyRoute(404);
      }
      if (script.dropChunk === chunkIndex) {
        return new Error('socket hang up');
      }
      sentBodies.push(new TextDecoder().decode(call.init.body as Uint8Array));
      received = range.end + 1;
      if (script.lostResponseAtChunk === chunkIndex) {
        return new Error('socket hang up');
      }
      return received >= totalBytes
        ? jsonRoute(200, { id: 'vid123' })
        : emptyRoute(308, { range: `bytes=0-${String(received - 1)}` });
    }
    if (call.url.includes('/thumbnails/set')) {
      return script.thumbnailResponse ?? jsonRoute(200, {});
    }
    if (call.url.includes('/playlistItems')) {
      return jsonRoute(200, { id: 'item-1' });
    }
    return emptyRoute(404);
  };

  return { answer, sentBodies };
}

function harness(script: UploadScript = {}, files: { path: string; contents: string }[] = []) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/promo', '/media/promo/out'],
    files: [{ path: '/media/promo/out/video.mp4', contents: VIDEO_BYTES }, ...files],
  });
  const upload = createFakeYoutubeUpload(script);
  const google = createFakeFetchRemote(upload.answer);
  const deps = createFakeRenderApiDependencies(callLog, {
    storage,
    fetchRemote: google.fetchRemote,
    clock: { nowIso: () => NOW_ISO },
  });
  deps.localStore.projects.insert('promo');
  const youtube = createYoutubeClient(deps, STUB_OAUTH);
  return { deps, google, upload, youtube };
}

function request(overrides: Partial<PublishPipelineRequest> = {}): PublishPipelineRequest {
  return {
    jobId: 'job-1',
    slug: 'promo',
    project: resolveMediaProject('/media/promo'),
    resume: false,
    platform: 'youtube',
    file: 'out/video.mp4',
    title: 'Mi video',
    description: 'Descripcion',
    tags: ['uno', 'dos'],
    privacy: 'public',
    publishAt: null,
    playlistId: null,
    thumbnail: null,
    categoryId: '22',
    madeForKids: false,
    defaultLanguage: 'es',
    ...overrides,
  };
}

interface ObserverLog {
  readonly stages: string[];
  readonly uploaded: number[];
}

function observer(cancelAfterChunks?: number): { observer: PublishPipelineObserver; log: ObserverLog } {
  const log: ObserverLog = { stages: [], uploaded: [] };
  return {
    log,
    observer: {
      stageStarted: (stage) => log.stages.push(stage),
      bytesUploaded: (uploadedBytes) => log.uploaded.push(uploadedBytes),
      cancellationRequested: () => cancelAfterChunks !== undefined && log.uploaded.length > cancelAfterChunks,
    },
  };
}

function run(h: ReturnType<typeof harness>, overrides: Partial<PublishPipelineRequest> = {}, watcher = observer()) {
  return runPublishPipeline(request(overrides), h.deps, watcher.observer, {
    youtube: h.youtube,
    sleep: async () => undefined,
    chunkSizeBytes: 4,
  });
}

function errorOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (cause: unknown) => toErrorPayload(cause),
  );
}

function initiateCall(h: ReturnType<typeof harness>): FakeFetchRemoteCall | undefined {
  return h.google.calls.find((call) => call.url.includes('uploadType=resumable&part='));
}

function chunkCalls(h: ReturnType<typeof harness>): FakeFetchRemoteCall[] {
  return h.google.calls.filter((call) => call.url === SESSION_URI && call.init.method === 'PUT');
}

describe('runPublishPipeline upload', () => {
  it('uploads the file in chunks, reports progress by bytes and answers the report keys', async () => {
    const h = harness();
    const watcher = observer();

    const report = await run(h, {}, watcher);

    expect(Object.keys(report).sort()).toEqual(['privacy', 'publishAt', 'title', 'url', 'videoId']);
    expect(report).toEqual({
      videoId: 'vid123',
      url: 'https://youtu.be/vid123',
      privacy: 'public',
      publishAt: null,
      title: 'Mi video',
    });
    expect(h.upload.sentBodies).toEqual(['0123', '4567', '89']);
    expect(watcher.log.stages).toEqual(['prepare', 'upload']);
    expect(watcher.log.uploaded).toEqual([0, 4, 8, 10, 10].slice(0, watcher.log.uploaded.length));
    expect(watcher.log.uploaded[watcher.log.uploaded.length - 1]).toBe(10);
  });

  it('opens the resumable session with the metadata, the size and the language and sends chunks without credentials', async () => {
    const h = harness();

    await run(h, { tags: ['a', 'b'], categoryId: '27', madeForKids: true, defaultLanguage: 'es' });

    const initiate = initiateCall(h);
    expect(initiate?.init.method).toBe('POST');
    expect(initiate?.init.headers).toMatchObject({
      authorization: 'Bearer access-token',
      'x-upload-content-length': '10',
      'x-upload-content-type': 'video/mp4',
    });
    expect(bodyJson(initiate as FakeFetchRemoteCall)).toEqual({
      snippet: {
        title: 'Mi video',
        description: 'Descripcion',
        tags: ['a', 'b'],
        categoryId: '27',
        defaultLanguage: 'es',
        defaultAudioLanguage: 'es',
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: true },
    });
    for (const chunk of chunkCalls(h)) {
      expect(chunk.init.headers).not.toHaveProperty('authorization');
    }
    expect(chunkCalls(h).map((call) => call.init.headers?.['content-range'])).toEqual([
      'bytes 0-3/10',
      'bytes 4-7/10',
      'bytes 8-9/10',
    ]);
  });

  it('records the publication as uploading and then published with its video id and url', async () => {
    const h = harness();

    await run(h);

    const rows = h.deps.localStore.publications.listByProject('promo');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      platform: 'youtube',
      file: 'out/video.mp4',
      title: 'Mi video',
      videoId: 'vid123',
      url: 'https://youtu.be/vid123',
      privacy: 'public',
      status: 'published',
      publishAt: null,
      publishedAt: NOW_ISO,
      jobId: 'job-1',
    });
  });

  it('resumes after a lost response: asks the uploaded range and does not resend the bytes', async () => {
    const h = harness({ lostResponseAtChunk: 1 });

    const report = await run(h);

    expect(report.videoId).toBe('vid123');
    expect(h.upload.sentBodies).toEqual(['0123', '4567', '89']);
    const ranges = chunkCalls(h).map((call) => call.init.headers?.['content-range']);
    expect(ranges).toEqual(['bytes 0-3/10', 'bytes 4-7/10', 'bytes */10', 'bytes 8-9/10']);
  });

  it('resends the chunk the server never received after an interruption', async () => {
    const h = harness({ dropChunk: 1 });

    await run(h);

    expect(h.upload.sentBodies).toEqual(['0123', '4567', '89']);
    const ranges = chunkCalls(h).map((call) => call.init.headers?.['content-range']);
    expect(ranges).toEqual(['bytes 0-3/10', 'bytes 4-7/10', 'bytes */10', 'bytes 4-7/10', 'bytes 8-9/10']);
  });

  it('fails with YOUTUBE_UPLOAD_FAILED and marks the publication failed when the connection keeps failing', async () => {
    const h = harness({ failAlways: true });

    const error = await errorOf(run(h));

    expect(error).toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED', stage: 'upload' });
    expect(h.deps.localStore.publications.listByProject('promo')[0]?.status).toBe('failed');
  });

  it('fails when the upload session expired and starts a new session on the next run', async () => {
    const h = harness({ sessionGoneAtChunk: 1 });

    const error = await errorOf(run(h));

    expect(error).toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED', stage: 'upload' });
    expect(error.hint).toContain('expired');
    const retried = await run(h);
    expect(retried.videoId).toBe('vid123');
    expect(h.google.calls.filter((call) => call.url.includes('uploadType=resumable&part='))).toHaveLength(2);
  });

  it('maps a quota error from YouTube to YOUTUBE_QUOTA_EXCEEDED', async () => {
    const h = harness({
      initiateResponse: jsonRoute(403, { error: { code: 403, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }),
    });

    const error = await errorOf(run(h));

    expect(error).toMatchObject({ code: 'YOUTUBE_QUOTA_EXCEEDED', stage: 'upload' });
    expect(h.deps.localStore.publications.listByProject('promo')[0]?.status).toBe('failed');
  });

  it('carries the reason Google gave in the hint of YOUTUBE_UPLOAD_FAILED', async () => {
    const h = harness({
      initiateResponse: jsonRoute(400, { error: { code: 400, message: 'Invalid title', errors: [{ reason: 'invalidTitle' }] } }),
    });

    const error = await errorOf(run(h));

    expect(error).toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED' });
    expect(error.hint).toContain('invalidTitle');
    expect(error.hint).toContain('Invalid title');
  });

  it('fails with PUBLISH_FILE_INVALID and records nothing when the video is missing', async () => {
    const h = harness();

    const error = await errorOf(run(h, { file: 'out/missing.mp4' }));

    expect(error).toMatchObject({ code: 'PUBLISH_FILE_INVALID', stage: 'prepare' });
    expect(h.deps.localStore.publications.listByProject('promo')).toEqual([]);
    expect(h.google.calls).toHaveLength(0);
  });
});

describe('runPublishPipeline scheduling', () => {
  it('uploads a scheduled video as private with status.publishAt and records it as scheduled', async () => {
    const h = harness();

    const report = await run(h, { publishAt: FUTURE_ISO, privacy: 'public' });

    expect(bodyJson(initiateCall(h) as FakeFetchRemoteCall).status).toEqual({
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
      publishAt: FUTURE_ISO,
    });
    expect(report).toMatchObject({ privacy: 'private', publishAt: FUTURE_ISO });
    expect(h.deps.localStore.publications.listByProject('promo')[0]).toMatchObject({
      status: 'scheduled',
      privacy: 'private',
      publishAt: FUTURE_ISO,
      publishedAt: null,
    });
  });

  it('ignores a publishAt that is already in the past and publishes with the chosen visibility', async () => {
    const h = harness();

    const report = await run(h, { publishAt: '2026-10-01T00:00:00.000Z', privacy: 'unlisted' });

    expect(bodyJson(initiateCall(h) as FakeFetchRemoteCall).status).toEqual({
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
    });
    expect(report).toMatchObject({ privacy: 'unlisted', publishAt: null });
  });
});

describe('runPublishPipeline credits', () => {
  const CREDITS = { path: '/media/promo/out/video.credits.txt', contents: 'Música: Tema por Autor (CC BY 4.0)\n' };

  it('appends the music credits after a blank line when the description lacks them', async () => {
    const h = harness({}, [CREDITS]);

    await run(h, { description: 'Descripcion' });

    expect(bodyJson(initiateCall(h) as FakeFetchRemoteCall).snippet).toMatchObject({
      description: 'Descripcion\n\nMúsica: Tema por Autor (CC BY 4.0)',
    });
  });

  it('does not append the credits twice when the description already carries them', async () => {
    const h = harness({}, [CREDITS]);

    await run(h, { description: 'Descripcion\n\nMúsica: Tema por Autor (CC BY 4.0)' });

    expect(bodyJson(initiateCall(h) as FakeFetchRemoteCall).snippet).toMatchObject({
      description: 'Descripcion\n\nMúsica: Tema por Autor (CC BY 4.0)',
    });
  });

  it('leaves the description untouched when the video has no credits file', async () => {
    const h = harness();

    await run(h, { description: 'Solo texto' });

    expect(bodyJson(initiateCall(h) as FakeFetchRemoteCall).snippet).toMatchObject({ description: 'Solo texto' });
  });
});

describe('runPublishPipeline thumbnail and playlist', () => {
  const THUMBNAIL = { path: '/media/promo/work/thumb.png', contents: 'png-bytes' };

  it('sets the thumbnail with its content type and adds the video to the playlist', async () => {
    const h = harness({}, [THUMBNAIL]);
    const watcher = observer();

    await run(h, { thumbnail: 'work/thumb.png', playlistId: 'PL1' }, watcher);

    const thumbnailCall = h.google.calls.find((call) => call.url.includes('/thumbnails/set'));
    expect(thumbnailCall?.url).toContain('videoId=vid123');
    expect(thumbnailCall?.init.headers).toMatchObject({ 'content-type': 'image/png' });
    const playlistCall = h.google.calls.find((call) => call.url.includes('/playlistItems'));
    expect(bodyJson(playlistCall as FakeFetchRemoteCall)).toEqual({
      snippet: { playlistId: 'PL1', resourceId: { kind: 'youtube#video', videoId: 'vid123' } },
    });
    expect(watcher.log.stages).toEqual(['prepare', 'upload', 'thumbnail', 'playlist']);
  });

  it('keeps the uploaded video published when the thumbnail fails and a retry finishes without uploading again', async () => {
    const h = harness({ thumbnailResponse: jsonRoute(403, { error: { message: 'no permission', errors: [{ reason: 'forbidden' }] } }) }, [
      THUMBNAIL,
    ]);

    const error = await errorOf(run(h, { thumbnail: 'work/thumb.png' }));

    expect(error).toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED', stage: 'thumbnail' });
    expect(error.hint).toContain('https://youtu.be/vid123');
    expect(h.deps.localStore.publications.listByProject('promo')).toHaveLength(1);
    expect(h.deps.localStore.publications.listByProject('promo')[0]?.status).toBe('published');

    const healthy = createFakeFetchRemote(() => jsonRoute(200, {}));
    const retryDeps = { ...h.deps, fetchRemote: healthy.fetchRemote };
    const retried = await runPublishPipeline(
      request({ thumbnail: 'work/thumb.png', resume: true, jobId: 'job-2' }),
      retryDeps,
      observer().observer,
      { youtube: createYoutubeClient(retryDeps, STUB_OAUTH), sleep: async () => undefined, chunkSizeBytes: 4 },
    );

    expect(retried.videoId).toBe('vid123');
    expect(healthy.calls.some((call) => call.url.includes('uploadType=resumable'))).toBe(false);
    expect(healthy.calls.some((call) => call.url.includes('/thumbnails/set'))).toBe(true);
    expect(h.deps.localStore.publications.listByProject('promo')).toHaveLength(1);
  });

  it('rejects a thumbnail that is not an allowed image before touching YouTube again', async () => {
    const h = harness({}, [{ path: '/media/promo/work/thumb.gif', contents: 'gif' }]);

    const error = await errorOf(run(h, { thumbnail: 'work/thumb.gif' }));

    expect(error).toMatchObject({ code: 'PUBLISH_FILE_INVALID', stage: 'thumbnail' });
  });
});

describe('runPublishPipeline cancellation and resume', () => {
  it('stops between chunks when cancellation is requested and marks the publication failed', async () => {
    const h = harness();

    const failure = await run(h, {}, observer(1)).catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(PublishPipelineCanceledError);
    expect(h.upload.sentBodies.length).toBeLessThan(3);
    expect(h.deps.localStore.publications.listByProject('promo')[0]?.status).toBe('failed');
  });

  it('resumes the stored session from the range YouTube reports when the same job is queued again', async () => {
    const h = harness();
    await run(h, {}, observer(1)).catch(() => undefined);
    const sentBefore = h.upload.sentBodies.length;
    h.google.calls.length = 0;

    const report = await run(h, { jobId: 'job-2' });

    expect(report.videoId).toBe('vid123');
    expect(h.google.calls.some((call) => call.url.includes('uploadType=resumable&part='))).toBe(false);
    expect(chunkCalls(h)[0]?.init.headers?.['content-range']).toBe('bytes */10');
    expect(h.upload.sentBodies.join('')).toBe(VIDEO_BYTES);
    expect(h.upload.sentBodies.length).toBeGreaterThan(sentBefore - 1);
  });
});
