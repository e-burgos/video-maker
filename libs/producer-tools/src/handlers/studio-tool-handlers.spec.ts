import { describe, expect, it } from 'vitest';
import type { Timeline } from '@video-maker/timeline-core';

import { createFakeRenderApiClient } from '../__fixtures__/fake-render-api-client';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createStudioToolHandlers } from './studio-tool-handlers';

function handlersWith(overrides: Parameters<typeof createFakeRenderApiClient>[0] = {}, model = 'sonnet') {
  const client = createFakeRenderApiClient(overrides);
  const handlers = createStudioToolHandlers({ client, model });
  return { client, handlers };
}

function withCaptionWords(timeline: Timeline, words: readonly string[]): Timeline {
  return {
    ...timeline,
    tracks: {
      ...timeline.tracks,
      captions: [
        {
          id: 'caption-under-test',
          from: 0,
          durationFrames: Math.max(words.length, 1),
          words: words.map((text, index) => ({ text, fromFrame: index, durationFrames: 1 })),
        },
      ],
    },
  };
}

function timelineNotFound(): Promise<never> {
  return Promise.reject(new StudioToolRuntimeError('FILE_NOT_FOUND', 'this project has no timeline yet'));
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
      mode: 'footage',
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

  it('get_project_overview reports the motion mode the server answers', async () => {
    const { handlers } = handlersWith({
      getProjectDetail: async () => ({
        slug: 'promo',
        mode: 'motion',
        layout: { raw: true, catalog: false, timeline: false, edl: false, out: false },
        assetSource: 'raw-scan',
        assetCounts: {},
      }),
      listProjectAssets: async () => [],
      listPendingAssets: async () => [],
      listRecentJobs: async () => [],
      readProducerScriptState: async () => 'none',
    });

    const result = await handlers.get_project_overview({});

    expect(result.data).toMatchObject({ mode: 'motion' });
  });

  it('start_job forwards a motion job without the model and keeps its fields', async () => {
    const { handlers, client } = handlersWith({
      createJob: async () => ({ id: 'job-9', kind: 'motion', state: 'queued', progress: null, report: null, error: null }),
    });

    const result = await handlers.start_job({ job: { kind: 'motion', phase: 'storyboard', takes: 3 } });

    expect(result.data).toEqual({ jobId: 'job-9', kind: 'motion', status: 'queued' });
    expect(client.calls).toEqual([{ method: 'createJob', args: [{ kind: 'motion', phase: 'storyboard', takes: 3 }] }]);
  });

  it('start_job rejects a motion job with a bad phase before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.start_job({ job: { kind: 'motion', phase: 'render' } })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(client.calls).toEqual([]);
  });

  it('get_motion_brands lists the brands from the client', async () => {
    const brands = [
      { id: 'acme', name: 'Acme', formats: ['16:9', '9:16'], music: [{ id: 'm1', mood: 'upbeat', bpm: 120, hasDrop: true }] },
    ];
    const { handlers, client } = handlersWith({ listMotionBrands: async () => brands });

    const result = await handlers.get_motion_brands({});

    expect(result.data).toEqual({ brands });
    expect(client.calls).toEqual([{ method: 'listMotionBrands', args: [] }]);
  });

  it('read_motion_brief wraps the stored brief', async () => {
    const brief = { version: 1, brand: 'acme', script: 'Hola', images: [] };
    const { handlers, client } = handlersWith({ getMotionBrief: async () => brief });

    const result = await handlers.read_motion_brief({});

    expect(result.data).toEqual({ brief });
    expect(client.calls).toEqual([{ method: 'getMotionBrief', args: [] }]);
  });

  it('write_motion_brief sends the brief and confirms the save', async () => {
    const brief = {
      version: 1,
      brand: 'acme',
      goal: 'launch',
      script: 'Hola',
      music: 'auto',
      images: [{ file: 'a.jpg', caption: 'a red car' }],
    };
    const { handlers, client } = handlersWith({ putMotionBrief: async () => undefined });

    const result = await handlers.write_motion_brief({ brief });

    expect(result.data).toEqual({ saved: true });
    expect(client.calls).toEqual([{ method: 'putMotionBrief', args: [brief] }]);
  });

  it('write_motion_storyboard sends the storyboard and confirms the save', async () => {
    const storyboard = { scenes: [{ kind: 'title', vo: 'Hola' }], music: { volume: 0.2 } };
    const { handlers, client } = handlersWith({ putMotionStoryboard: async () => undefined });

    const result = await handlers.write_motion_storyboard({ storyboard });

    expect(result.data).toEqual({ saved: true });
    expect(client.calls).toEqual([{ method: 'putMotionStoryboard', args: [storyboard] }]);
  });

  it('write_motion_storyboard rejects a missing storyboard before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(handlers.write_motion_storyboard({})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });

  it('write_motion_brief rejects a brief with no script before calling the client', async () => {
    const { handlers, client } = handlersWith();

    await expect(
      handlers.write_motion_brief({ brief: { version: 1, brand: 'acme', images: [] } }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(client.calls).toEqual([]);
  });

  it('write_motion_brief propagates the server field error unchanged', async () => {
    const { handlers } = handlersWith({
      putMotionBrief: async () => {
        throw new StudioToolRuntimeError('INVALID_INPUT', 'images.0.file: not found in raw/images');
      },
    });

    await expect(
      handlers.write_motion_brief({ brief: { version: 1, brand: 'acme', script: 'x', images: [] } }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', hint: 'images.0.file: not found in raw/images' });
  });

  it('read_motion_storyboard wraps the stored storyboard', async () => {
    const storyboard = { scenes: [{ kind: 'hero', voice: 'Hola' }] };
    const { handlers, client } = handlersWith({ getMotionStoryboard: async () => storyboard });

    const result = await handlers.read_motion_storyboard({});

    expect(result.data).toEqual({ storyboard });
    expect(client.calls).toEqual([{ method: 'getMotionStoryboard', args: [] }]);
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

  it('wait_for_job reports the full render API error shape of a failed job instead of rejecting it', async () => {
    const client = createFakeRenderApiClient({
      getJob: async (jobId) => ({
        id: jobId,
        kind: 'voice',
        state: 'failed',
        progress: { stage: 'synthesize', processedScenes: 8, totalScenes: 8, percent: 100 },
        report: null,
        error: {
          code: 'VOICE_SYNTHESIS_FAILED',
          stage: 'synthesize',
          message: 'The speech synthesizer failed while producing a scene track.',
          resource: 'line-07',
        },
      }),
    });
    const handlers = createStudioToolHandlers({ client, model: 'sonnet', clock: () => 0 });

    const result = await handlers.wait_for_job({ jobId: 'job-1', timeoutSeconds: 5 });

    expect(result.data).toMatchObject({
      status: 'failed',
      error: {
        code: 'VOICE_SYNTHESIS_FAILED',
        stage: 'synthesize',
        message: 'The speech synthesizer failed while producing a scene track.',
        resource: 'line-07',
      },
    });
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
    expect(client.calls.map((call) => call.method)).toEqual(['getTimeline', 'getTimeline', 'putTimeline']);
    expect(client.calls[2]).toEqual({ method: 'putTimeline', args: [timeline] });
  });

  describe('put_timeline caption guard', () => {
    it('accepts the first timeline ever, without checking captions', async () => {
      const timeline = withCaptionWords(buildMinimalTimeline(), ['hola']);
      const { handlers, client } = handlersWith({
        getTimeline: timelineNotFound,
        putTimeline: async () => undefined,
      });

      const result = await handlers.put_timeline({ timeline });

      expect(result.data).toEqual({ saved: true });
      expect(client.calls[1]).toEqual({ method: 'putTimeline', args: [timeline] });
    });

    it('rejects a replacement whose caption words differ from what is saved (lost accents)', async () => {
      const saved = withCaptionWords(buildMinimalTimeline(), ['quién', 'ahí', 'elegís']);
      const rewritten = withCaptionWords(buildMinimalTimeline(), ['quien', 'ahi', 'elegis']);
      const { handlers, client } = handlersWith({
        getTimeline: async () => saved,
        putTimeline: async () => undefined,
      });

      await expect(handlers.put_timeline({ timeline: rewritten })).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        hint: expect.stringContaining('patch_timeline'),
      });
      expect(client.calls.some((call) => call.method === 'putTimeline')).toBe(false);
    });

    it('accepts a caption change when editCaptions is true', async () => {
      const saved = withCaptionWords(buildMinimalTimeline(), ['quién']);
      const rewritten = withCaptionWords(buildMinimalTimeline(), ['quien']);
      const { handlers, client } = handlersWith({
        getTimeline: async () => saved,
        putTimeline: async () => undefined,
      });

      const result = await handlers.put_timeline({ timeline: rewritten, editCaptions: true });

      expect(result.data).toEqual({ saved: true });
      expect(client.calls.some((call) => call.method === 'getTimeline')).toBe(false);
      expect(client.calls[0]).toEqual({ method: 'putTimeline', args: [rewritten] });
    });

    it('accepts the timeline as a JSON string that parses to the same object', async () => {
      const saved = withCaptionWords(buildMinimalTimeline(), ['hola']);
      const { handlers, client } = handlersWith({
        getTimeline: async () => saved,
        putTimeline: async () => undefined,
      });

      const result = await handlers.put_timeline({ timeline: JSON.stringify(saved) });

      expect(result.data).toEqual({ saved: true });
      expect(client.calls[1]).toEqual({ method: 'putTimeline', args: [saved] });
    });

    it('rejects a string timeline that is not valid JSON', async () => {
      const { handlers } = handlersWith({ getTimeline: timelineNotFound });

      await expect(handlers.put_timeline({ timeline: 'not json' })).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  describe('patch_timeline', () => {
    it('replaces only the requested sections and leaves captions untouched byte-for-byte', async () => {
      const current = withCaptionWords(buildMinimalTimeline(), ['quién', 'ahí', 'elegís']);
      let saved: unknown = null;
      const { handlers, client } = handlersWith({
        getTimeline: async () => current,
        putTimeline: async (timeline) => {
          saved = timeline;
        },
      });

      const logo = { assetId: 'logo-asset', position: 'bottom-left' as const, widthRatio: 0.4, marginRatio: 0.035, opacity: 0.5 };
      const result = await handlers.patch_timeline({ logo });

      expect(result.data).toEqual({ changed: ['logo'], summary: 'Updated logo.' });
      expect(client.calls.map((call) => call.method)).toEqual(['getTimeline', 'putTimeline']);
      expect((saved as Timeline).logo).toEqual(logo);
      expect((saved as Timeline).tracks.captions).toEqual(current.tracks.captions);
    });

    it('replaces the music track and audioMix together and reports both as changed', async () => {
      const current = buildMinimalTimeline();
      let saved: unknown = null;
      const { handlers } = handlersWith({
        getTimeline: async () => current,
        putTimeline: async (timeline) => {
          saved = timeline;
        },
      });

      const music = [
        { id: 'music-under-test', assetId: 'minimal-aroll', from: 0, durationFrames: 10, trimStartMs: 0, gainDb: -8 },
      ];
      const result = await handlers.patch_timeline({ music, audioMix: current.audioMix });

      expect(result.data).toEqual({ changed: ['audioMix', 'music'], summary: 'Updated audioMix, music.' });
      expect((saved as Timeline).tracks.music).toEqual(music);
    });

    it('rejects when the patched timeline fails Timeline validation', async () => {
      const current = buildMinimalTimeline();
      const collidingId = current.tracks.aroll[0]?.id;
      if (collidingId === undefined) {
        throw new Error('fixture must have at least one aroll clip');
      }
      const { handlers, client } = handlersWith({ getTimeline: async () => current });

      const music = [
        { id: collidingId, assetId: 'minimal-aroll', from: 0, durationFrames: 10, trimStartMs: 0, gainDb: 0 },
      ];

      await expect(handlers.patch_timeline({ music })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(client.calls.some((call) => call.method === 'putTimeline')).toBe(false);
    });

    it('errors when the project has no timeline yet', async () => {
      const { handlers } = handlersWith({ getTimeline: timelineNotFound });

      await expect(handlers.patch_timeline({ logo: null })).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });
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
