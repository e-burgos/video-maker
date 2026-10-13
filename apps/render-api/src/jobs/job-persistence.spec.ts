import { describe, expect, it } from 'vitest';

import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import { parseStoredJob, parseStoredParams, toStoredParams } from './job-persistence';
import type { CreateJobInput } from './render-job';

const TIMELINE = buildMinimalTimeline();

const BASE_ROW = {
  id: 'job-0001',
  slug: 'demo-01',
  createdAt: '2026-09-23T00:00:00.000Z',
  startedAt: null as string | null,
  finishedAt: null as string | null,
};

describe('toStoredParams / parseStoredParams', () => {
  it('round-trips a render job, including the timeline snapshot', () => {
    const input: CreateJobInput = {
      kind: 'render',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      timeline: TIMELINE,
    };

    const stored = toStoredParams(input);
    expect(stored).toEqual({ kind: 'render', timeline: TIMELINE });

    const parsed = parseStoredParams('render', JSON.parse(JSON.stringify(stored)));
    expect(parsed).toEqual({ kind: 'render', timeline: TIMELINE });
  });

  it('round-trips the sample of a render job and omits it when absent', () => {
    const input: CreateJobInput = { kind: 'render', slug: 'demo-01', projectRoot: '/media/demo-01', timeline: TIMELINE, sample: { seconds: 12 } };

    const stored = toStoredParams(input);

    expect(stored).toEqual({ kind: 'render', timeline: TIMELINE, sample: { seconds: 12 } });
    expect(parseStoredParams('render', JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(toStoredParams({ ...input, sample: undefined })).not.toHaveProperty('sample');
  });

  it('round-trips the sample of a motion job and rejects one outside 8 to 20 seconds', () => {
    const input: CreateJobInput = { kind: 'motion', slug: 'demo-01', projectRoot: '/media/demo-01', phase: 'video', output: 'video.mp4', takes: 5, sample: { seconds: 10 } };

    const stored = toStoredParams(input);

    expect(parseStoredParams('motion', JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseStoredParams('motion', { ...stored, sample: { seconds: 60 } })).toBeNull();
    expect(parseStoredParams('render', { kind: 'render', timeline: TIMELINE, sample: { seconds: 1 } })).toBeNull();
  });

  it('round-trips a montage job', () => {
    const input: CreateJobInput = {
      kind: 'montage',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      preset: 'software-demo',
      seed: 7,
      scriptPath: null,
      scriptText: 'hola',
      logo: 'auto',
      format: 'reels-9x16',
      voice: 'aroll',
      captionStyle: 'bold-impact',
    };

    const stored = toStoredParams(input);
    const parsed = parseStoredParams('montage', JSON.parse(JSON.stringify(stored)));

    expect(parsed).toEqual({
      kind: 'montage',
      preset: 'software-demo',
      seed: 7,
      scriptPath: null,
      scriptText: 'hola',
      logo: 'auto',
      format: 'reels-9x16',
      voice: 'aroll',
      captionStyle: 'bold-impact',
    });
  });

  it('round-trips the music mode of a montage job and omits it when absent', () => {
    const base: CreateJobInput = {
      kind: 'montage',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      preset: 'software-demo',
      seed: 7,
      scriptPath: null,
      scriptText: null,
      logo: 'auto',
      format: 'reels-9x16',
      voice: 'aroll',
      captionStyle: null,
    };
    const withMusic: CreateJobInput = { ...base, musicMode: 'segments', musicFloorDb: -24 };

    expect(parseStoredParams('montage', JSON.parse(JSON.stringify(toStoredParams(withMusic))))).toMatchObject({
      musicMode: 'segments',
      musicFloorDb: -24,
    });
    expect(Object.keys(toStoredParams(base))).not.toContain('musicMode');
    expect(parseStoredParams('montage', { ...toStoredParams(base) })).not.toHaveProperty('musicMode');
    expect(parseStoredParams('montage', { ...toStoredParams(base), musicMode: 'loud' })).toBeNull();
  });

  it('round-trips a storyboard job', () => {
    const input: CreateJobInput = {
      kind: 'storyboard',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      brief: 'un producto nuevo',
      scriptText: null,
      model: 'sonnet',
    };

    const parsed = parseStoredParams('storyboard', JSON.parse(JSON.stringify(toStoredParams(input))));
    expect(parsed).toEqual({ kind: 'storyboard', brief: 'un producto nuevo', scriptText: null, model: 'sonnet' });
  });

  it('round-trips a voice job', () => {
    const input: CreateJobInput = {
      kind: 'voice',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      voiceId: 'es_AR-daniela-high',
      sceneIds: ['scene-1', 'scene-2'],
      scriptText: null,
      scriptPath: null,
      gapMs: 900,
    };

    const parsed = parseStoredParams('voice', JSON.parse(JSON.stringify(toStoredParams(input))));
    expect(parsed).toEqual({
      kind: 'voice',
      voiceId: 'es_AR-daniela-high',
      sceneIds: ['scene-1', 'scene-2'],
      scriptText: null,
      scriptPath: null,
      gapMs: 900,
    });
  });

  it('round-trips a photo-aroll job', () => {
    const input: CreateJobInput = {
      kind: 'photo-aroll',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      photos: ['raw/images/a.jpg', 'raw/images/b.jpg'],
      output: 'ad.mp4',
      fps: 30,
    };

    const parsed = parseStoredParams('photo-aroll', JSON.parse(JSON.stringify(toStoredParams(input))));
    expect(parsed).toEqual({
      kind: 'photo-aroll',
      photos: ['raw/images/a.jpg', 'raw/images/b.jpg'],
      output: 'ad.mp4',
      fps: 30,
    });
  });

  it('rejects a value that is not an object, and a render timeline that fails schema validation', () => {
    expect(parseStoredParams('render', null)).toBeNull();
    expect(parseStoredParams('render', 'nope')).toBeNull();
    expect(parseStoredParams('render', { timeline: { not: 'a timeline' } })).toBeNull();
  });

  it('rejects a montage record missing or mistyping a required field', () => {
    expect(parseStoredParams('montage', { preset: 'software-demo' })).toBeNull();
    expect(
      parseStoredParams('montage', {
        preset: 'software-demo',
        seed: 'not-a-number',
        scriptPath: null,
        scriptText: null,
        logo: 'auto',
        format: 'reels-9x16',
        voice: 'aroll',
        captionStyle: null,
      }),
    ).toBeNull();
  });

  it('rejects a voice record whose sceneIds is not an array of strings', () => {
    expect(
      parseStoredParams('voice', {
        voiceId: null,
        sceneIds: [1, 2],
        scriptText: null,
        scriptPath: null,
        gapMs: 900,
      }),
    ).toBeNull();
  });

  it('rejects a photo-aroll record whose photos is not an array of strings', () => {
    expect(parseStoredParams('photo-aroll', { photos: 'not-an-array', output: 'ad.mp4', fps: 30 })).toBeNull();
  });
});

describe('publish job persistence', () => {
  const PUBLISH_INPUT: CreateJobInput = {
    kind: 'publish',
    slug: 'demo-01',
    projectRoot: '/media/demo-01',
    platform: 'youtube',
    file: 'out/video.mp4',
    title: 'Titulo',
    description: 'Descripcion',
    tags: ['a', 'b'],
    privacy: 'unlisted',
    publishAt: '2099-01-01T10:00:00.000Z',
    playlistIds: ['PL1'],
    thumbnail: 'work/thumb.png',
    categoryId: '22',
    madeForKids: false,
    defaultLanguage: 'es',
    ignoreReview: true,
  };

  it('reads the single playlistId of a job stored before playlistIds existed', () => {
    const withoutPlaylistIds: Record<string, unknown> = { ...toStoredParams(PUBLISH_INPUT) };
    delete withoutPlaylistIds.playlistIds;

    const legacy = parseStoredParams('publish', { ...withoutPlaylistIds, playlistId: 'PL_OLD' });

    expect(legacy).toMatchObject({ playlistIds: ['PL_OLD'] });
    expect(parseStoredParams('publish', { ...withoutPlaylistIds, playlistId: null })).toMatchObject({ playlistIds: [] });
  });

  it('round-trips the publish parameters without the slug and the project root', () => {
    const stored = toStoredParams(PUBLISH_INPUT);

    expect(Object.keys(stored).sort()).toEqual([
      'categoryId',
      'defaultLanguage',
      'description',
      'file',
      'ignoreReview',
      'kind',
      'madeForKids',
      'platform',
      'playlistIds',
      'privacy',
      'publishAt',
      'tags',
      'thumbnail',
      'title',
    ]);
    expect(parseStoredParams('publish', JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('rejects a publish record with an unknown platform or privacy or a wrong type', () => {
    const stored = JSON.parse(JSON.stringify(toStoredParams(PUBLISH_INPUT))) as Record<string, unknown>;

    expect(parseStoredParams('publish', { ...stored, platform: 'tiktok' })).toBeNull();
    expect(parseStoredParams('publish', { ...stored, privacy: 'secret' })).toBeNull();
    expect(parseStoredParams('publish', { ...stored, tags: 'a,b' })).toBeNull();
    expect(parseStoredParams('publish', { ...stored, madeForKids: 'no' })).toBeNull();
  });

  it('reads a stored publish job back with its progress and report', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'publish',
      state: 'succeeded',
      params: {},
      progress: { stage: 'upload', uploadedBytes: 10, totalBytes: 10, percent: 100 },
      report: { videoId: 'abc', url: 'https://youtu.be/abc', privacy: 'public', publishAt: null, title: 'T' },
      error: null,
      retryOf: null,
    });

    expect(job.kind).toBe('publish');
    expect(job.report).toMatchObject({ videoId: 'abc' });
  });
});

describe('parseStoredJob', () => {
  it('builds a render job from a fully valid row', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'render',
      state: 'running',
      params: { kind: 'render', timeline: TIMELINE },
      progress: { stage: 'render', renderedFrames: 10, totalFrames: 100, percent: 10 },
      report: null,
      error: null,
      retryOf: null,
    });

    expect(job).toEqual({
      id: 'job-0001',
      slug: 'demo-01',
      kind: 'render',
      state: 'running',
      createdAt: BASE_ROW.createdAt,
      startedAt: null,
      finishedAt: null,
      progress: { stage: 'render', renderedFrames: 10, totalFrames: 100, percent: 10 },
      report: null,
      error: null,
    });
  });

  it('builds a job with a terminal state and a report', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'montage',
      state: 'succeeded',
      params: {},
      progress: null,
      report: { catalogPath: 'work/catalog.json' },
      error: null,
      retryOf: null,
    });

    expect(job.state).toBe('succeeded');
    expect(job.report).toEqual({ catalogPath: 'work/catalog.json' });
  });

  it('surfaces an unknown state as failed with JOB_RECORD_INVALID, without throwing', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'render',
      state: 'orbiting',
      params: {},
      progress: null,
      report: null,
      error: null,
      retryOf: null,
    });

    expect(job.state).toBe('failed');
    expect(job.kind).toBe('render');
    expect((job.error as RenderApiErrorPayload | null)?.code).toBe('JOB_RECORD_INVALID');
  });

  it('surfaces an unknown kind as a failed render job with JOB_RECORD_INVALID, without throwing', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'teleport',
      state: 'succeeded',
      params: {},
      progress: null,
      report: null,
      error: null,
      retryOf: null,
    });

    expect(job.kind).toBe('render');
    expect(job.state).toBe('failed');
    expect((job.error as RenderApiErrorPayload | null)?.code).toBe('JOB_RECORD_INVALID');
  });

  it('falls back to createdAt for finishedAt on an invalid row that never got one', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'ghost-kind',
      state: 'queued',
      params: {},
      progress: null,
      report: null,
      error: null,
      retryOf: null,
    });

    expect(job.finishedAt).toBe(BASE_ROW.createdAt);
  });

  it('passes through the persisted error payload for a failed job', () => {
    const job = parseStoredJob({
      ...BASE_ROW,
      kind: 'storyboard',
      state: 'failed',
      params: {},
      progress: null,
      report: null,
      error: { code: 'AI_AGENT_FAILED', stage: null, message: 'boom' },
      retryOf: null,
    });

    expect(job.error).toEqual({ code: 'AI_AGENT_FAILED', stage: null, message: 'boom' });
  });
});

describe('review job persistence', () => {
  const REVIEW_INPUT: CreateJobInput = {
    kind: 'review',
    slug: 'demo-01',
    projectRoot: '/media/demo-01',
    file: 'out/video.mp4',
  };

  it('stores only the file and reads it back', () => {
    const stored = toStoredParams(REVIEW_INPUT);

    expect(stored).toEqual({ kind: 'review', file: 'out/video.mp4' });
    expect(parseStoredParams('review', JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseStoredParams('review', { file: 5 })).toBeNull();
  });

  it('reads a publish record stored before ignoreReview existed as not ignoring the review', () => {
    const full = toStoredParams({
      kind: 'publish',
      slug: 'demo-01',
      projectRoot: '/media/demo-01',
      platform: 'youtube',
      file: 'out/video.mp4',
      title: 'T',
      description: '',
      tags: [],
      privacy: 'public',
      publishAt: null,
      playlistIds: [],
      thumbnail: null,
      categoryId: '22',
      madeForKids: false,
      defaultLanguage: 'es',
      ignoreReview: true,
    }) as Record<string, unknown>;
    const legacy = Object.fromEntries(Object.entries(full).filter(([key]) => key !== 'ignoreReview'));

    expect(parseStoredParams('publish', legacy)).toMatchObject({ ignoreReview: false });
  });
});

describe('reference job persistence', () => {
  const REFERENCE_INPUT: CreateJobInput = {
    kind: 'reference',
    slug: 'demo-01',
    projectRoot: '/media/demo-01',
    file: 'raw/reference/modelo.mp4',
  };

  it('stores only the file and reads it back', () => {
    const stored = toStoredParams(REFERENCE_INPUT);

    expect(stored).toEqual({ kind: 'reference', file: 'raw/reference/modelo.mp4' });
    expect(parseStoredParams('reference', JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseStoredParams('reference', { file: 5 })).toBeNull();
  });
});
