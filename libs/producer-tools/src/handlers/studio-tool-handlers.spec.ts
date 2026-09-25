import { describe, expect, it } from 'vitest';

import { createFakeRenderApiClient } from '../__fixtures__/fake-render-api-client';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createStudioToolHandlers } from './studio-tool-handlers';

function handlersWith(overrides: Parameters<typeof createFakeRenderApiClient>[0] = {}, model = 'sonnet') {
  const client = createFakeRenderApiClient(overrides);
  const handlers = createStudioToolHandlers({ client, model });
  return { client, handlers };
}

describe('createStudioToolHandlers', () => {
  it('get_project_overview composes detail, assets, recent jobs and script state', async () => {
    const { handlers } = handlersWith({
      getProjectDetail: async () => ({
        slug: 'pitch-deck',
        layout: { raw: true, catalog: true, timeline: true, edl: false, out: false },
        assetSource: 'catalog',
        assetCounts: {},
      }),
      listProjectAssets: async () => [
        { path: 'raw/aroll/a.mp4', role: 'aroll', media: { durationMs: 1000 } },
        { path: 'raw/images/b.jpg', role: 'image', media: null },
      ],
      listPendingAssets: async () => [
        { id: 'asset-1', fileName: 'dropped.mp4', proposedRole: 'aroll', proposalReason: 'has-audio' },
      ],
      listRecentJobs: async () => [{ id: 'job-1', kind: 'render', state: 'succeeded', createdAt: '2026-01-01' }],
      readProducerScriptState: async () => 'timed',
    });

    const result = await handlers.get_project_overview({});

    expect(result.data).toEqual({
      slug: 'pitch-deck',
      title: 'pitch-deck',
      assets: [
        { path: 'raw/aroll/a.mp4', role: 'aroll', durationMs: 1000 },
        { path: 'raw/images/b.jpg', role: 'image', durationMs: null },
      ],
      pendingAssets: [
        { assetId: 'asset-1', fileName: 'dropped.mp4', proposedRole: 'aroll', proposalReason: 'has-audio' },
      ],
      hasTimeline: true,
      script: 'timed',
      recentJobs: [{ jobId: 'job-1', kind: 'render', status: 'succeeded' }],
    });
  });

  it('probe_media forwards the path and returns the client result', async () => {
    const { handlers, client } = handlersWith({
      probeMedia: async (path) => ({ path, durationMs: 1000, video: null, audio: null }),
    });

    const result = await handlers.probe_media({ path: 'raw/aroll/a.mp4' });

    expect(result.data).toMatchObject({ path: 'raw/aroll/a.mp4' });
    expect(client.calls).toEqual([{ method: 'probeMedia', args: ['raw/aroll/a.mp4'] }]);
  });

  it('probe_media rejects an unsafe path before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.probe_media({ path: '/etc/passwd' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });

  it('probe_media propagates a mapped client error unchanged', async () => {
    const { handlers } = handlersWith({
      probeMedia: async () => {
        throw new StudioToolRuntimeError('FILE_NOT_FOUND', 'raw/aroll/missing.mp4 does not exist');
      },
    });

    await expect(handlers.probe_media({ path: 'raw/aroll/missing.mp4' })).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });

  it('extract_frames returns data and base64 image bytes for each frame', async () => {
    const { handlers } = handlersWith({
      extractFrames: async () => [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }],
      readFileBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    });

    const result = await handlers.extract_frames({ path: 'raw/aroll/a.mp4', atSeconds: [1] });

    expect(result.data).toEqual({ frames: [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }] });
    expect(result.images).toEqual([{ mimeType: 'image/jpeg', base64: Buffer.from([1, 2, 3]).toString('base64') }]);
  });

  it('extract_frames rejects atSeconds outside 1..12 before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.extract_frames({ path: 'raw/aroll/a.mp4', atSeconds: [] })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(client.calls).toEqual([]);
  });

  it('list_voices maps language to its code and reports the default voice id', async () => {
    const { handlers } = handlersWith({
      listVoices: async () => ({
        voices: [
          { id: 'a', label: 'A', language: { code: 'es-AR', region: 'AR' }, quality: 'high', description: 'd', isDefault: true },
        ],
        defaultVoiceId: 'a',
      }),
    });

    const result = await handlers.list_voices({});

    expect(result.data).toEqual({
      voices: [{ id: 'a', label: 'A', language: 'es-AR', quality: 'high', description: 'd' }],
      defaultVoiceId: 'a',
    });
  });

  it('read_project_text / write_project_text / copy_asset forward to the client', async () => {
    const { handlers, client } = handlersWith({
      readProjectText: async (path) => ({ path, content: 'hi' }),
      writeProjectText: async (path) => ({ path, bytes: 2 }),
      copyAsset: async (from, role, filename) => ({ path: `raw/${role}/${filename}` }),
    });

    await handlers.read_project_text({ path: 'work/producer/notes.md' });
    await handlers.write_project_text({ path: 'work/producer/notes.md', content: 'hi' });
    await handlers.copy_asset({ from: 'raw/aroll/a.mp4', role: 'aroll', filename: 'b.mp4' });

    expect(client.calls.map((call) => call.method)).toEqual(['readProjectText', 'writeProjectText', 'copyAsset']);
  });

  it('start_job injects the model for voice and storyboard but not for other kinds', async () => {
    const { handlers, client } = handlersWith({
      createJob: async (body) => ({
        id: 'job-1',
        kind: (body as { kind: string }).kind,
        state: 'queued',
        progress: null,
        report: null,
        error: null,
      }),
    });

    await handlers.start_job({ job: { kind: 'voice' } });
    await handlers.start_job({ job: { kind: 'storyboard', brief: 'idea' } });
    await handlers.start_job({ job: { kind: 'render' } });
    await handlers.start_job({ job: { kind: 'montage' } });

    const bodies = client.calls.map((call) => call.args[0] as Record<string, unknown>);
    expect(bodies[0]).toMatchObject({ kind: 'voice', model: 'sonnet' });
    expect(bodies[1]).toMatchObject({ kind: 'storyboard', model: 'sonnet' });
    expect(bodies[2]).toEqual({ kind: 'render' });
    expect(bodies[3]).toEqual({ kind: 'montage' });
  });

  it('start_job rejects an unknown kind before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.start_job({ job: { kind: 'bogus' } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });

  it('start_job rejects a call that is not wrapped in "job"', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.start_job({ kind: 'render' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });

  it('wait_for_job polls until the job reaches a terminal state', async () => {
    let calls = 0;
    const client = createFakeRenderApiClient({
      getJob: async (jobId) => {
        calls += 1;
        return {
          id: jobId,
          kind: 'render',
          state: calls < 3 ? 'running' : 'succeeded',
          progress: { stage: 'render' },
          report: calls < 3 ? null : { path: 'out/a.mp4' },
          error: null,
        };
      },
    });
    const sleeps: number[] = [];
    const handlers = createStudioToolHandlers({
      client,
      model: 'sonnet',
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      clock: () => 0,
    });

    const result = await handlers.wait_for_job({ jobId: 'job-1', timeoutSeconds: 60 });

    expect(result.data).toMatchObject({ status: 'succeeded', result: { path: 'out/a.mp4' } });
    expect(calls).toBe(3);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('wait_for_job returns status running once the timeout elapses without reaching a terminal state', async () => {
    const client = createFakeRenderApiClient({
      getJob: async (jobId) => ({
        id: jobId,
        kind: 'render',
        state: 'running',
        progress: null,
        report: null,
        error: null,
      }),
    });
    let now = 0;
    const handlers = createStudioToolHandlers({
      client,
      model: 'sonnet',
      clock: () => now,
      sleep: async () => {
        now += 2000;
      },
    });

    const result = await handlers.wait_for_job({ jobId: 'job-1', timeoutSeconds: 5 });

    expect(result.data).toMatchObject({ status: 'running' });
  });

  it('cancel_job forwards the jobId and reports the resulting status', async () => {
    const { handlers, client } = handlersWith({
      cancelJob: async (jobId) => ({ id: jobId, kind: 'render', state: 'canceled', progress: null, report: null, error: null }),
    });

    const result = await handlers.cancel_job({ jobId: 'job-1' });

    expect(result.data).toEqual({ jobId: 'job-1', status: 'canceled' });
    expect(client.calls).toEqual([{ method: 'cancelJob', args: ['job-1'] }]);
  });

  it('get_timeline and put_timeline forward the timeline document', async () => {
    const timeline = buildMinimalTimeline();
    const { handlers, client } = handlersWith({
      getTimeline: async () => timeline,
      putTimeline: async () => undefined,
    });

    const got = await handlers.get_timeline({});
    expect(got.data).toEqual({ timeline });

    const put = await handlers.put_timeline({ timeline });
    expect(put.data).toEqual({ saved: true });
    expect(client.calls[1]).toEqual({ method: 'putTimeline', args: [timeline] });
  });

  it('search_free_music and import_music forward to the client', async () => {
    const { handlers, client } = handlersWith({
      searchFreeMusic: async () => [
        { resultId: 'commons-1', title: 't', durationMs: 1000, license: 'CC0', author: 'a', pageUrl: 'u' },
      ],
      importMusic: async (resultId) => ({ path: 'raw/audio/a.mp3', credit: { resultId } }),
    });

    const search = await handlers.search_free_music({ mood: 'calm', maxResults: 5 });
    expect(search.data).toEqual({
      results: [{ resultId: 'commons-1', title: 't', durationMs: 1000, license: 'CC0', author: 'a', pageUrl: 'u' }],
    });

    const imported = await handlers.import_music({ resultId: 'commons-1' });
    expect(imported.data).toMatchObject({ path: 'raw/audio/a.mp3' });
    expect(client.calls[1]).toEqual({ method: 'importMusic', args: ['commons-1'] });
  });

  it('search_free_media and import_media forward to the client', async () => {
    const { handlers, client } = handlersWith({
      searchFreeMedia: async () => [
        {
          resultId: 'commons-video-1',
          source: 'commons',
          kind: 'video',
          title: 't',
          license: 'CC0',
          author: 'a',
          pageUrl: 'u',
          durationMs: 5000,
          width: null,
          height: null,
        },
      ],
      importMedia: async (resultId) => ({ path: 'raw/broll/a.mp4', credit: { resultId } }),
    });

    const search = await handlers.search_free_media({ query: 'ocean', kind: 'video', maxResults: 5 });
    expect(search.data).toMatchObject({
      results: [{ resultId: 'commons-video-1', source: 'commons', kind: 'video' }],
    });
    expect(client.calls[0]).toEqual({ method: 'searchFreeMedia', args: ['ocean', 'video', 5] });

    const imported = await handlers.import_media({ resultId: 'commons-video-1' });
    expect(imported.data).toMatchObject({ path: 'raw/broll/a.mp4' });
    expect(client.calls[1]).toEqual({ method: 'importMedia', args: ['commons-video-1'] });
  });

  it('view_images previews each path and returns data and base64 image bytes', async () => {
    const { handlers, client } = handlersWith({
      previewImages: async (paths) => paths.map((path) => ({ path, previewPath: `work/frames/previews/${path}.jpg` })),
      readFileBytes: async () => ({ bytes: new Uint8Array([4, 5, 6]), mimeType: 'image/jpeg' }),
    });

    const result = await handlers.view_images({ paths: ['raw/images/a.jpg'] });

    expect(result.data).toEqual({
      previews: [{ path: 'raw/images/a.jpg', previewPath: 'work/frames/previews/raw/images/a.jpg.jpg' }],
    });
    expect(result.images).toEqual([{ mimeType: 'image/jpeg', base64: Buffer.from([4, 5, 6]).toString('base64') }]);
    expect(client.calls[0]).toEqual({ method: 'previewImages', args: [['raw/images/a.jpg']] });
  });

  it('view_images rejects more than 6 paths before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(
      handlers.view_images({ paths: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg', 'g.jpg'] }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });
});
