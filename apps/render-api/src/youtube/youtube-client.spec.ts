import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeFetchRemote } from '../__fixtures__/fake-fetch-remote';
import type { FakeFetchRemoteAnswer } from '../__fixtures__/fake-fetch-remote';
import { emptyRoute, jsonRoute } from '../__fixtures__/fake-google';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createYoutubeClient } from './youtube-client';
import type { YoutubeOAuth } from './youtube-oauth';

function oauthWith(tokens: string[]): { oauth: YoutubeOAuth; invalidated: () => number } {
  let invalidated = 0;
  let issued = 0;
  return {
    invalidated: () => invalidated,
    oauth: {
      status: async () => ({ clientConfigured: true, connected: true, channel: null }),
      saveClient: async () => ({ clientConfigured: true, connected: true, channel: null }),
      startConnect: async () => ({ authUrl: '' }),
      disconnect: async () => undefined,
      accessToken: async () => tokens[Math.min(issued++, tokens.length - 1)] ?? '',
      invalidateAccessToken: () => {
        invalidated += 1;
      },
    },
  };
}

function client(answer: FakeFetchRemoteAnswer, tokens = ['tok-1', 'tok-2']) {
  const google = createFakeFetchRemote(answer);
  const deps = createFakeRenderApiDependencies(createCallLog(), { fetchRemote: google.fetchRemote });
  const auth = oauthWith(tokens);
  return { youtube: createYoutubeClient(deps, auth.oauth), google, auth };
}

describe('createYoutubeClient', () => {
  it('lists the playlists of the channel across pages', async () => {
    const h = client((call) =>
      call.url.includes('pageToken=NEXT')
        ? jsonRoute(200, { items: [{ id: 'PL2', snippet: { title: 'Dos' } }] })
        : jsonRoute(200, { items: [{ id: 'PL1', snippet: { title: 'Uno' } }], nextPageToken: 'NEXT' }),
    );

    expect(await h.youtube.listPlaylists()).toEqual([
      { id: 'PL1', title: 'Uno' },
      { id: 'PL2', title: 'Dos' },
    ]);
  });

  it('refreshes the access token once after a 401 and retries the request', async () => {
    const h = client((call) =>
      call.init.headers?.authorization === 'Bearer tok-1'
        ? jsonRoute(401, { error: { message: 'expired' } })
        : jsonRoute(200, { items: [] }),
    );

    expect(await h.youtube.listPlaylists()).toEqual([]);
    expect(h.auth.invalidated()).toBe(1);
    expect(h.google.calls).toHaveLength(2);
  });

  it('fails with YOUTUBE_NOT_CONNECTED when the retry is rejected too', async () => {
    const h = client(() => jsonRoute(401, { error: { message: 'revoked' } }));

    await expect(h.youtube.listPlaylists()).rejects.toMatchObject({ code: 'YOUTUBE_NOT_CONNECTED' });
  });

  it('reads the next offset from the Range header of a 308 and treats a missing Range as nothing received', async () => {
    const answers = [emptyRoute(308, { range: 'bytes=0-262143' }), emptyRoute(308)];
    const h = client((_call, index) => answers[index] ?? emptyRoute(500));
    const session = 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=x';

    expect(await h.youtube.queryUploadStatus(session, 1_000_000)).toEqual({ kind: 'incomplete', nextOffset: 262144 });
    expect(await h.youtube.queryUploadStatus(session, 1_000_000)).toEqual({ kind: 'incomplete', nextOffset: 0 });
  });

  it('classifies 5xx as transient, 404 and 410 as a gone session and a finished upload as complete', async () => {
    const answers = [emptyRoute(503), emptyRoute(404), emptyRoute(410), jsonRoute(201, { id: 'vid9' })];
    const h = client((_call, index) => answers[index] ?? emptyRoute(500));
    const session = 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=x';
    const bytes = new Uint8Array([1, 2]);

    expect((await h.youtube.uploadChunk(session, bytes, 0, 2)).kind).toBe('transient');
    expect((await h.youtube.uploadChunk(session, bytes, 0, 2)).kind).toBe('session-gone');
    expect((await h.youtube.uploadChunk(session, bytes, 0, 2)).kind).toBe('session-gone');
    expect(await h.youtube.uploadChunk(session, bytes, 0, 2)).toEqual({ kind: 'complete', videoId: 'vid9' });
  });

  it('reports a transport failure while uploading as transient so the pipeline can resume', async () => {
    const h = client(() => new Error('socket hang up'));

    const outcome = await h.youtube.uploadChunk('https://www.googleapis.com/upload/x', new Uint8Array(1), 0, 1);

    expect(outcome.kind).toBe('transient');
  });

  it('fails when the resumable session is opened without a Location header', async () => {
    const h = client(() => emptyRoute(200));

    await expect(
      h.youtube.initiateUpload(
        {
          title: 't',
          description: '',
          tags: [],
          categoryId: '22',
          defaultLanguage: 'es',
          privacyStatus: 'public',
          publishAt: null,
          madeForKids: false,
        },
        10,
      ),
    ).rejects.toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED' });
  });

  it('maps a quota error while adding to a playlist', async () => {
    const h = client(() => jsonRoute(403, { error: { message: 'q', errors: [{ reason: 'quotaExceeded' }] } }));

    await expect(h.youtube.addToPlaylist('PL1', 'vid')).rejects.toMatchObject({ code: 'YOUTUBE_QUOTA_EXCEEDED' });
  });
});
