import { describe, expect, it } from 'vitest';

import { createRenderApiClient } from './render-api-client';
import { RenderApiError } from './render-api-error';
import type { FetchLike } from './render-api-client';

type Call = { url: string; init: RequestInit | undefined };

function clientAnswering(response: () => Response) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return response();
  };
  return { client: createRenderApiClient(fetchImpl), calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('render api client — youtube', () => {
  it('reads the integration and keeps a missing thumbnail as null', async () => {
    const { client, calls } = clientAnswering(() =>
      json({ clientConfigured: true, connected: true, channel: { id: 'UC1', title: 'Chan' } }),
    );

    const integration = await client.getYouTubeIntegration();

    expect(calls[0]?.url).toBe('/api/integrations/youtube');
    expect(Object.keys(integration).sort()).toEqual(['channel', 'clientConfigured', 'connected']);
    expect(integration.channel).toEqual({ id: 'UC1', title: 'Chan', thumbnailUrl: null });
  });

  it('puts the client credential as json', async () => {
    const { client, calls } = clientAnswering(() => json({ clientConfigured: true, connected: false, channel: null }));

    await client.putYouTubeClient({ clientId: 'id', clientSecret: 'secret' });

    expect(calls[0]?.url).toBe('/api/integrations/youtube/client');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  it('starts the connection and disconnects on a 204', async () => {
    const connect = clientAnswering(() => json({ authUrl: 'https://accounts.google.com/x' }));
    expect(await connect.client.connectYouTube()).toEqual({ authUrl: 'https://accounts.google.com/x' });
    expect(connect.calls[0]?.init?.method).toBe('POST');

    const disconnect = clientAnswering(() => new Response(null, { status: 204 }));
    await expect(disconnect.client.disconnectYouTube()).resolves.toBeUndefined();
    expect(disconnect.calls[0]?.init?.method).toBe('DELETE');
  });

  it('surfaces a typed error when disconnecting fails', async () => {
    const { client } = clientAnswering(() =>
      json({ error: { code: 'YOUTUBE_UPLOAD_FAILED', stage: null, message: 'nope' } }, 502),
    );

    await expect(client.disconnectYouTube()).rejects.toMatchObject({ code: 'YOUTUBE_UPLOAD_FAILED' });
  });

  it('reads the publish options and the metadata draft', async () => {
    const options = clientAnswering(() =>
      json({
        files: [{ path: 'out/v.mp4', durationSec: 10, width: 1920, height: 1080, isShort: false, sizeBytes: 5 }],
        playlists: [{ id: 'PL1', title: 'List' }],
        defaults: { privacy: 'public' },
      }),
    );
    expect((await options.client.getYouTubePublishOptions('demo')).files[0]?.path).toBe('out/v.mp4');
    expect(options.calls[0]?.url).toBe('/api/projects/demo/publish/youtube/options');

    const draft = clientAnswering(() => json({ title: 'T', description: 'D', tags: ['a'] }));
    expect(await draft.client.draftYouTubeMetadata('demo', 'out/v.mp4')).toEqual({
      title: 'T',
      description: 'D',
      tags: ['a'],
    });
    expect(JSON.parse(String(draft.calls[0]?.init?.body))).toEqual({ file: 'out/v.mp4' });
  });

  it('rejects an options document with a malformed file', async () => {
    const { client } = clientAnswering(() => json({ files: [{ path: 'x' }], playlists: [], defaults: {} }));

    await expect(client.getYouTubePublishOptions('demo')).rejects.toBeInstanceOf(RenderApiError);
  });

  it('creates a publish job posting kind and platform with the input', async () => {
    const { client, calls } = clientAnswering(() =>
      json({
        id: 'job-1',
        kind: 'publish',
        slug: 'demo',
        state: 'queued',
        createdAt: '2026-10-08T10:00:00.000Z',
        startedAt: null,
        finishedAt: null,
        progress: null,
        report: null,
        error: null,
      }),
    );

    const job = await client.createPublishJob('demo', {
      file: 'out/v.mp4',
      title: 'T',
      description: '',
      tags: [],
      privacy: 'private',
    });

    expect(job.kind).toBe('publish');
    expect(Object.keys(JSON.parse(String(calls[0]?.init?.body))).sort()).toEqual([
      'description',
      'file',
      'kind',
      'platform',
      'privacy',
      'tags',
      'title',
    ]);
  });

  it('lists the publications of a project', async () => {
    const { client, calls } = clientAnswering(() =>
      json([
        {
          id: 'p1',
          platform: 'youtube',
          file: 'out/v.mp4',
          title: 'T',
          videoId: 'abc',
          url: 'https://youtu.be/abc',
          privacy: 'public',
          status: 'published',
          publishAt: null,
          publishedAt: '2026-10-08T10:00:00.000Z',
          createdAt: '2026-10-08T09:00:00.000Z',
        },
      ]),
    );

    const publications = await client.listPublications('demo');

    expect(calls[0]?.url).toBe('/api/projects/demo/publications');
    expect(publications[0]?.status).toBe('published');
  });
});
