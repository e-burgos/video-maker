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

  it('write_motion_brief keeps the named boxes of an image', async () => {
    const { handlers, client } = handlersWith({ putMotionBrief: async () => undefined });
    const brief = {
      version: 1 as const,
      brand: 'acme',
      script: 'Hola',
      images: [{ file: 'images/a.png', caption: 'Cotizador', boxes: [{ name: 'Plan Propio', x: 0.175, y: 0.358, w: 0.308, h: 0.104 }] }],
    };

    await handlers.write_motion_brief({ brief });

    expect(client.calls).toEqual([{ method: 'putMotionBrief', args: [brief] }]);
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

  describe('get_reference_brief', () => {
    const summary = {
      name: 'modelo',
      file: 'raw/reference/modelo.mp4',
      briefFile: 'work/reference/modelo.brief.json',
      durationSec: 30,
      scenes: 1,
      cutsPerMinute: 0,
      hasVoice: false,
      summary: 'Referencia de prueba.',
      createdAt: '2026-10-12T10:00:00.000Z',
    };
    const brief = {
      version: 1 as const,
      file: 'raw/reference/modelo.mp4',
      durationSec: 30,
      format: { width: 1080, height: 1920, fps: 30, orientation: 'portrait' as const },
      scenes: [{ index: 0, startSec: 0, endSec: 30, durationSec: 30, keyframe: 'work/reference/modelo/scene-00.jpg' }],
      pace: { cutsPerMinute: 0, meanSceneSec: 30, medianSceneSec: 30 },
      voice: null,
      audio: { integratedLufs: -14, longSilences: [] },
      summary: 'Referencia de prueba.',
      createdAt: '2026-10-12T10:00:00.000Z',
    };

    it('lists the analysed references when no name is given', async () => {
      const { handlers, client } = handlersWith({ listReferences: async () => [summary] });

      const result = await handlers.get_reference_brief({});

      expect(result.data).toEqual({ references: [summary], brief: null });
      expect(Object.keys(result.data as object).sort()).toEqual(['brief', 'references']);
      expect(client.calls.map((call) => call.method)).toEqual(['listReferences']);
    });

    it('returns the full brief of the named reference next to the list', async () => {
      const { handlers, client } = handlersWith({ listReferences: async () => [summary], getReference: async () => brief });

      const result = await handlers.get_reference_brief({ name: 'modelo' });

      expect(result.data).toEqual({ references: [summary], brief });
      expect(client.calls.find((call) => call.method === 'getReference')?.args).toEqual(['modelo']);
    });

    it('explains how to analyse a reference that has no brief yet', async () => {
      const { handlers } = handlersWith({
        listReferences: async () => [],
        getReference: () => Promise.reject(new StudioToolRuntimeError('FILE_NOT_FOUND', 'That reference has no analysis yet.')),
      });

      await expect(handlers.get_reference_brief({ name: 'modelo' })).rejects.toMatchObject({
        code: 'FILE_NOT_FOUND',
        hint: expect.stringContaining('start_job {"kind":"reference"'),
      });
    });

    it('rejects a name with a folder', async () => {
      const { handlers } = handlersWith();

      await expect(handlers.get_reference_brief({ name: 'raw/reference/modelo' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });

  it('start_job passes a reference job through with its file and no model', async () => {
    const { handlers, client } = handlersWith({ createJob: async () => ({ id: 'job-9', kind: 'reference', state: 'queued', progress: null, report: null, error: null }) });

    const result = await handlers.start_job({ job: { kind: 'reference', file: 'raw/reference/modelo.mp4' } });

    expect(result.data).toEqual({ jobId: 'job-9', kind: 'reference', status: 'queued' });
    expect(client.calls.find((call) => call.method === 'createJob')?.args).toEqual([{ kind: 'reference', file: 'raw/reference/modelo.mp4' }]);
  });

  it('get_project_overview accepts review and publish jobs among the recent ones', async () => {
    const { handlers } = handlersWith({
      getProjectDetail: async () => ({
        slug: 'p',
        layout: { raw: true, catalog: true, timeline: true, edl: false, out: false },
        assetSource: 'catalog',
        assetCounts: {},
      }),
      listProjectAssets: async () => [],
      listPendingAssets: async () => [],
      listRecentJobs: async () => [
        { id: 'a', kind: 'review', state: 'succeeded', createdAt: '2026-01-02' },
        { id: 'b', kind: 'reference', state: 'running', createdAt: '2026-01-01' },
      ],
      readProducerScriptState: async () => 'none',
    });

    const result = await handlers.get_project_overview({});

    expect((result.data as { recentJobs: unknown[] }).recentJobs).toEqual([
      { jobId: 'a', kind: 'review', status: 'succeeded' },
      { jobId: 'b', kind: 'reference', status: 'running' },
    ]);
  });

  describe('get_render_review', () => {
    const review = {
      file: 'out/video.mp4',
      status: 'fail' as const,
      createdAt: '2026-10-11T10:00:00.000Z',
      metrics: { masterIntegratedLufs: -17.2, voiceMusicMarginDb: null },
      findings: [
        {
          id: 'f1',
          check: 'master',
          severity: 'critical' as const,
          message: 'Master too quiet',
          timeRange: { startSec: 1, endSec: 2 },
          proposedFix: 'Raise the master gain',
        },
      ],
    };

    it('returns the summary of the review the client found', async () => {
      const { handlers, client } = handlersWith({ getRenderReview: async () => review });

      const result = await handlers.get_render_review({ file: 'out/video.mp4' });

      expect(result.data).toEqual({
        file: 'out/video.mp4',
        status: 'fail',
        createdAt: '2026-10-11T10:00:00.000Z',
        metrics: review.metrics,
        findings: [
          {
            id: 'f1',
            check: 'master',
            severity: 'critical',
            message: 'Master too quiet',
            timeRange: { startSec: 1, endSec: 2 },
            proposedFix: 'Raise the master gain',
          },
        ],
        visualReviewState: 'not-applicable',
      });
      expect(client.calls).toEqual([{ method: 'getRenderReview', args: ['out/video.mp4'] }]);
    });

    const sceneFrames = [
      { sceneId: 'hook', index: 1, startSec: 0, endSec: 4, atSec: 2, frame: 'out/video.review/scene-01.jpg', voice: 'Hola' },
    ];

    it('lists the scene frames and says the visual review is pending (US-023-603)', async () => {
      const { handlers } = handlersWith({ getRenderReview: async () => ({ ...review, sceneFrames }) });

      const result = await handlers.get_render_review({});

      expect(result.data).toMatchObject({ sceneFrames, visualReviewState: 'pending' });
    });

    it('reports a recorded visual review', async () => {
      const visualReview = { recordedAt: '2026-10-12T11:00:00.000Z', scenes: [{ sceneId: 'hook', shows: 'Título', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok' as const, note: '' }] };
      const { handlers } = handlersWith({ getRenderReview: async () => ({ ...review, sceneFrames, visualReview }) });

      const result = await handlers.get_render_review({});

      expect(result.data).toMatchObject({ visualReview, visualReviewState: 'recorded' });
    });

    it('reports a stored review that carries version and delivery like the studio writes it', async () => {
      const stored = { ...review, version: 1, delivery: { kind: 'motion' } } as unknown as typeof review;
      const { handlers } = handlersWith({ getRenderReview: async () => stored });

      const result = await handlers.get_render_review({ file: 'out/video.mp4' });

      expect(result.data).toMatchObject({ file: 'out/video.mp4', status: 'fail' });
      expect(result.data).not.toHaveProperty('version');
    });

    it('asks for the latest review when no file is given', async () => {
      const { handlers, client } = handlersWith({ getRenderReview: async () => review });

      await handlers.get_render_review({});

      expect(client.calls).toEqual([{ method: 'getRenderReview', args: [undefined] }]);
    });

    it('says nothing was reviewed when the client finds no review and no review job is pending', async () => {
      const { handlers } = handlersWith({ getRenderReview: async () => null, listRecentJobs: async () => [] });

      await expect(handlers.get_render_review({})).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });

    it('waits for the review job that is still running after the render and then returns its review', async () => {
      let reviewDone = false;
      const client = createFakeRenderApiClient({
        getRenderReview: async () => (reviewDone ? review : null),
        listRecentJobs: async () => [{ id: 'job-review', kind: 'review', state: 'running', createdAt: '2026-10-12T21:21:00.000Z' }],
        getJob: async () => {
          reviewDone = true;
          return { id: 'job-review', kind: 'review', state: 'succeeded' } as Awaited<ReturnType<typeof client.getJob>>;
        },
      });
      const handlers = createStudioToolHandlers({ client, model: 'sonnet', sleep: async () => undefined });

      const result = await handlers.get_render_review({ file: 'out/video.mp4' });

      expect(result.data).toMatchObject({ file: 'out/video.mp4', status: 'fail' });
    });

    it('rejects a file outside out/ before calling the client', async () => {
      const { handlers, client } = handlersWith();

      await expect(handlers.get_render_review({ file: 'raw/video.mp4' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(client.calls).toEqual([]);
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
    await handlers.start_job({ job: { kind: 'render', sample: { seconds: 10 } } });
    await handlers.start_job({ job: { kind: 'montage' } });

    const bodies = client.calls.map((call) => call.args[0] as Record<string, unknown>);
    expect(bodies[0]).toMatchObject({ kind: 'voice', model: 'sonnet' });
    expect(bodies[1]).toMatchObject({ kind: 'storyboard', model: 'sonnet' });
    expect(bodies[2]).toEqual({ kind: 'render', sample: { seconds: 10 } });
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

  describe('production proposal (US-023-401, US-023-403)', () => {
    const job = { id: 'job-1', kind: 'render', state: 'queued', progress: null, report: null, error: null };
    const startable = (proposal: { status: 'pending' | 'approved' } | null) =>
      handlersWith({ getProposalState: async () => proposal, createJob: async () => job });

    it.each([
      ['no proposal', null],
      ['a pending proposal', { status: 'pending' as const }],
    ])('refuses a full render with PROPOSAL_NOT_APPROVED and %s, without calling createJob', async (_label, proposal) => {
      const { handlers, client } = startable(proposal);

      await expect(handlers.start_job({ job: { kind: 'render' } })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED', hint: expect.stringContaining('Proposal card') });
      expect(client.calls.map((call) => call.method)).toEqual(['getProposalState']);
    });

    it.each([
      [{ kind: 'motion' }],
      [{ kind: 'motion', phase: 'video' }],
      [{ kind: 'motion', phase: 'all', overwrite: true }],
    ])('refuses the full motion render %j until the proposal is approved', async (input) => {
      const { handlers } = startable(null);

      await expect(handlers.start_job({ job: input })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
    });

    it.each([
      [{ kind: 'render' }],
      [{ kind: 'motion', phase: 'video' }],
    ])('starts %j once the proposal is approved', async (input) => {
      const { handlers, client } = startable({ status: 'approved' });

      const result = await handlers.start_job({ job: input });

      expect(result.data).toMatchObject({ jobId: 'job-1', status: 'queued' });
      expect(client.calls.map((call) => call.method)).toEqual(['getProposalState', 'createJob']);
    });

    it.each([
      [{ kind: 'render', sample: { seconds: 10 } }],
      [{ kind: 'motion', phase: 'video', sample: { seconds: 8 } }],
      [{ kind: 'motion', phase: 'storyboard' }],
      [{ kind: 'montage' }],
      [{ kind: 'voice' }],
    ])('never checks the proposal for %j', async (input) => {
      const { handlers, client } = startable(null);

      await handlers.start_job({ job: input });

      expect(client.calls.map((call) => call.method)).toEqual(['createJob']);
    });

    it('lets the user override the block explicitly and does not forward the flag to the studio', async () => {
      const { handlers, client } = startable(null);

      await handlers.start_job({ job: { kind: 'render', skipProposal: true } });

      expect(client.calls).toEqual([{ method: 'createJob', args: [{ kind: 'render' }] }]);
    });

    it.each([[{ kind: 'render', sample: { seconds: 5 } }], [{ kind: 'render', sample: { seconds: 25 } }], [{ kind: 'render', skipProposal: false }]])(
      'rejects the invalid job %j before calling the client',
      async (input) => {
        const { handlers, client } = startable({ status: 'approved' });

        await expect(handlers.start_job({ job: input })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(client.calls).toEqual([]);
      },
    );

    const DRAFT = {
      recommendedId: 'directo',
      concepts: [
        { id: 'directo', title: 'Directo', angle: 'Paso a paso', format: 'youtube-16x9', durationSec: 90, scenes: 8, delivery: { kind: 'tutorial', requiresVoice: true } },
        { id: 'reel', title: 'Reel', angle: 'Un gesto', format: 'reels-9x16', durationSec: 30, scenes: 4, delivery: { kind: 'short' }, musicMode: 'segments' },
      ],
    };

    const REVIEW = {
      version: 1 as const,
      reviewedAt: '2026-10-12T10:00:00.000Z',
      items: [
        { file: 'images/a.png', source: 'project' as const, shows: 'El equipo', verdict: 'fits' as const, reason: 'Sirve' },
        { file: 'brand:counter-15', source: 'brand' as const, shows: 'Un menu', verdict: 'unfit' as const, reason: 'No es un equipo' },
      ],
      gaps: [{ need: 'Easy Pro en un TV', note: 'sin foto' }],
    };
    const IMAGE_ASSETS = [
      { path: 'raw/images/a.png', role: 'image', media: null },
      { path: 'raw/aroll/clip.mp4', role: 'aroll', media: null },
      { path: 'raw/logo/l.png', role: 'logo', media: null },
    ];

    it('propose_production sends the draft to the studio and reports it pending once the material was reviewed', async () => {
      const { handlers, client } = handlersWith({
        getMaterialReview: async () => REVIEW,
        listProjectAssets: async () => IMAGE_ASSETS,
        putProposal: async () => ({ concepts: 2 }),
      });

      const result = await handlers.propose_production(DRAFT);

      expect(result.data).toEqual({ saved: true, status: 'pending', concepts: 2 });
      expect(client.calls.map((call) => call.method)).toEqual(['getMaterialReview', 'listProjectAssets', 'putProposal']);
      expect(client.calls.find((call) => call.method === 'putProposal')?.args).toEqual([DRAFT]);
    });

    it('propose_production fails with MATERIAL_NOT_REVIEWED when the project has no review, without saving', async () => {
      const { handlers, client } = handlersWith({ getMaterialReview: async () => null, listProjectAssets: async () => IMAGE_ASSETS });

      await expect(handlers.propose_production(DRAFT)).rejects.toMatchObject({
        code: 'MATERIAL_NOT_REVIEWED',
        hint: expect.stringContaining('review_material'),
      });
      expect(client.calls.map((call) => call.method)).not.toContain('putProposal');
    });

    it('propose_production names the project images the review leaves out, whichever alias it used', async () => {
      const { handlers } = handlersWith({
        getMaterialReview: async () => ({ ...REVIEW, items: [REVIEW.items[1] as (typeof REVIEW.items)[number]] }),
        listProjectAssets: async () => [...IMAGE_ASSETS, { path: 'raw/images/b.png', role: 'image', media: null }],
      });

      await expect(handlers.propose_production(DRAFT)).rejects.toMatchObject({
        code: 'MATERIAL_NOT_REVIEWED',
        hint: expect.stringContaining('raw/images/a.png, raw/images/b.png'),
      });
    });

    it('review_material sends the review to the studio and counts the verdicts', async () => {
      const { handlers, client } = handlersWith({ putMaterialReview: async () => REVIEW });
      const draft = { items: REVIEW.items, gaps: REVIEW.gaps };

      const result = await handlers.review_material(draft);

      expect(result.data).toEqual({ saved: true, items: 2, fits: 1, doubtful: 0, unfit: 1, gaps: 1 });
      expect(client.calls).toEqual([{ method: 'putMaterialReview', args: [draft] }]);
    });

    describe('record_visual_review (US-023-603)', () => {
      const scenes = [
        { sceneId: 'hook', shows: 'Título', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok' as const, note: '' },
        { sceneId: 'cta', shows: 'Una foto de comida', matchesVoice: true, legible: true, couldBeOtherProduct: true, verdict: 'fix' as const, note: 'Usar el equipo' },
      ];
      const report = {
        file: 'out/video.mp4',
        status: 'fail' as const,
        createdAt: '2026-10-12T10:00:00.000Z',
        metrics: {},
        findings: [{ id: 'visual-review-01', check: 'visual-review', severity: 'critical' as const, message: 'Escena cta: podría ser de otro producto', proposedFix: 'Usar el equipo' }],
      };

      it('sends the scenes for the given file and answers what is still critical', async () => {
        const { handlers, client } = handlersWith({ putVisualReview: async () => report });

        const result = await handlers.record_visual_review({ file: 'out/video.mp4', scenes });

        expect(result.data).toEqual({
          saved: true,
          file: 'out/video.mp4',
          status: 'fail',
          scenes: 2,
          flaggedScenes: 1,
          criticalFindings: ['Escena cta: podría ser de otro producto'],
        });
        expect(client.calls).toEqual([{ method: 'putVisualReview', args: ['out/video.mp4', scenes] }]);
      });

      it('uses the most recent review when no file is given', async () => {
        const { handlers, client } = handlersWith({ getRenderReview: async () => report, putVisualReview: async () => report });

        await handlers.record_visual_review({ scenes });

        expect(client.calls.map((call) => call.method)).toEqual(['getRenderReview', 'putVisualReview']);
      });

      it('says there is nothing to review when no render was reviewed', async () => {
        const { handlers } = handlersWith({ getRenderReview: async () => null });

        await expect(handlers.record_visual_review({ scenes })).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
      });

      it('propagates VISUAL_REVIEW_NOT_VIEWED from the studio', async () => {
        const { handlers } = handlersWith({
          putVisualReview: async () => {
            throw new StudioToolRuntimeError('VISUAL_REVIEW_NOT_VIEWED', 'look at these with view_images: out/video.review/scene-02.jpg');
          },
        });

        await expect(handlers.record_visual_review({ file: 'out/video.mp4', scenes })).rejects.toMatchObject({ code: 'VISUAL_REVIEW_NOT_VIEWED' });
      });

      it.each([
        [{ scenes: [] }],
        [{ scenes: [{ ...scenes[0], verdict: 'maybe' }] }],
        [{ scenes, file: 'raw/video.mp4' }],
        [{ file: 'out/video.mp4' }],
      ])('rejects a malformed review before calling the studio (%#)', async (input) => {
        const { handlers, client } = handlersWith();

        await expect(handlers.record_visual_review(input)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(client.calls).toEqual([]);
      });
    });

    it.each([
      [{ items: [{ ...REVIEW.items[0], verdict: 'great' }], gaps: [] }],
      [{ items: [] }],
      [{ items: [{ ...REVIEW.items[1], source: 'project' }], gaps: [] }],
    ])('review_material rejects a malformed review before calling the studio (%#)', async (input) => {
      const { handlers, client } = handlersWith();

      await expect(handlers.review_material(input)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(client.calls).toEqual([]);
    });

    it.each([
      [{ ...DRAFT, concepts: [DRAFT.concepts[0]] }],
      [{ ...DRAFT, recommendedId: 'otro' }],
      [{ ...DRAFT, status: 'approved' }],
      [{ ...DRAFT, concepts: [{ ...DRAFT.concepts[0], format: 'cinema' }, DRAFT.concepts[1]] }],
    ])('propose_production rejects an invalid proposal before calling the studio (%#)', async (input) => {
      const { handlers, client } = handlersWith();

      await expect(handlers.propose_production(input)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(client.calls).toEqual([]);
    });
  });
});
