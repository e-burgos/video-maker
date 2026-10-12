import { describe, expect, it } from 'vitest';

import { referenceJob } from './__fixtures__/reference';

import {
  isJobKind,
  isMontageStage,
  isRenderJobState,
  isRenderPipelineStage,
  isTerminalRenderJobState,
  parseJob,
  parseMontageJob,
  parseRenderJob,
  parseRenderJobListing,
  parseStoryboardJob,
  isStoryboardJobSource,
  isStoryboardStage,
  showsAssetProgress,
  showsFrameProgress,
} from './parse-render-job';
import type {
  MontageJob,
  MontageJobProgress,
  RenderJob,
  RenderJobProgress,
  StoryboardJob,
} from './render-api-types';

const BASE_JOB: RenderJob = {
  id: 'job-0001',
  kind: 'render',
  slug: 'smoke-ingest',
  state: 'running',
  createdAt: '2026-09-09T10:00:00.000Z',
  startedAt: '2026-09-09T10:00:01.000Z',
  finishedAt: null,
  progress: { stage: 'render', renderedFrames: 240, totalFrames: 538, percent: 44.6 },
  report: null,
  error: null,
};

function progressAt(stage: RenderJobProgress['stage']): RenderJobProgress {
  return { stage, renderedFrames: null, totalFrames: null, percent: null };
}

describe('isRenderJobState', () => {
  it('accepts the six states', () => {
    for (const state of ['queued', 'running', 'canceling', 'succeeded', 'failed', 'canceled']) {
      expect(isRenderJobState(state)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isRenderJobState('cancelled')).toBe(false);
    expect(isRenderJobState(1)).toBe(false);
    expect(isRenderJobState(null)).toBe(false);
  });
});

describe('isRenderPipelineStage', () => {
  it('accepts the five stages', () => {
    for (const stage of ['prepare', 'render', 'mix', 'mux', 'verify']) {
      expect(isRenderPipelineStage(stage)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isRenderPipelineStage('encode')).toBe(false);
    expect(isRenderPipelineStage(undefined)).toBe(false);
  });
});

describe('isTerminalRenderJobState', () => {
  it('marks succeeded, failed and canceled as terminal', () => {
    expect(isTerminalRenderJobState('succeeded')).toBe(true);
    expect(isTerminalRenderJobState('failed')).toBe(true);
    expect(isTerminalRenderJobState('canceled')).toBe(true);
  });

  it('marks queued, running and canceling as not terminal', () => {
    expect(isTerminalRenderJobState('queued')).toBe(false);
    expect(isTerminalRenderJobState('running')).toBe(false);
    expect(isTerminalRenderJobState('canceling')).toBe(false);
  });
});

describe('showsFrameProgress', () => {
  it('is true only while progress.stage is render', () => {
    expect(showsFrameProgress(progressAt('render'))).toBe(true);
  });

  it('is false for every other stage', () => {
    expect(showsFrameProgress(progressAt('prepare'))).toBe(false);
    expect(showsFrameProgress(progressAt('mix'))).toBe(false);
    expect(showsFrameProgress(progressAt('mux'))).toBe(false);
    expect(showsFrameProgress(progressAt('verify'))).toBe(false);
  });

  it('is false when there is no progress at all', () => {
    expect(showsFrameProgress(null)).toBe(false);
  });
});

describe('parseRenderJob', () => {
  it('narrows a well-formed render job document', () => {
    expect(parseRenderJob(BASE_JOB)).toEqual(BASE_JOB);
  });

  it('narrows a state: failed body with its embedded error, instead of throwing', () => {
    const failed: RenderJob = {
      ...BASE_JOB,
      state: 'failed',
      progress: null,
      finishedAt: '2026-09-09T10:00:30.000Z',
      error: { code: 'INVALID_TIMELINE', stage: 'render', message: 'The timeline failed validation.' },
    };

    expect(parseRenderJob(failed)).toEqual(failed);
  });

  it('narrows a succeeded job carrying its full pipeline report', () => {
    const succeeded: RenderJob = {
      ...BASE_JOB,
      state: 'succeeded',
      progress: null,
      finishedAt: '2026-09-09T10:01:00.000Z',
      report: {
        renderId: 'job-0001',
        startedAt: '2026-09-09T10:00:01.000Z',
        finishedAt: '2026-09-09T10:01:00.000Z',
        deliverable: {
          resource: 'out/job-0001.mp4',
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 538,
        },
        intermediates: {
          mutedVideoResource: 'work/renders/job-0001/video-muted.mp4',
          masterAudioResource: 'work/renders/job-0001/master.wav',
        },
        loudness: {
          withinTolerance: true,
          integratedLufs: -14.2,
          truePeakDbtp: -1.1,
          integratedDeltaLu: 0.2,
          truePeakDeltaDb: 0.3,
        },
      },
    };

    expect(parseRenderJob(succeeded)).toEqual(succeeded);
  });

  it('rejects a body outside the contract as RESPONSE_SHAPE_UNEXPECTED, not a thrown TypeError', () => {
    expect(() => parseRenderJob({ id: 'job-0001' })).toThrow(/a job document/);

    try {
      parseRenderJob(null);
    } catch (error) {
      expect(error).toMatchObject({ code: 'RESPONSE_SHAPE_UNEXPECTED', status: 200 });
    }
  });
});

describe('parseRenderJobListing', () => {
  it('accepts the automatic review jobs that follow a render', () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0002',
          kind: 'review' as const,
          state: 'running' as const,
          stage: 'measure',
          errorCode: null,
          createdAt: '2026-10-11T10:00:00.000Z',
          startedAt: '2026-10-11T10:00:01.000Z',
          finishedAt: null,
        },
      ],
    };

    expect(parseRenderJobListing(listing)).toEqual(listing);
  });

  it('narrows a listing of job summaries', () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0001',
          kind: 'render' as const,
          state: 'queued' as const,
          stage: null,
          errorCode: null,
          createdAt: '2026-09-09T10:00:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
        {
          id: 'job-0002',
          kind: 'montage' as const,
          state: 'running' as const,
          stage: 'transcribe' as const,
          errorCode: null,
          createdAt: '2026-09-09T10:05:00.000Z',
          startedAt: '2026-09-09T10:05:01.000Z',
          finishedAt: null,
        },
      ],
    };

    expect(parseRenderJobListing(listing)).toEqual(listing);
  });

  it('accepts an empty jobs array', () => {
    expect(parseRenderJobListing({ slug: 'smoke-ingest', jobs: [] })).toEqual({
      slug: 'smoke-ingest',
      jobs: [],
    });
  });

  it('rejects a listing whose jobs are not summaries', () => {
    expect(() => parseRenderJobListing({ slug: 'smoke-ingest', jobs: [{ id: 'job-0001' }] })).toThrow(
      /a render job listing/,
    );
  });
});

const BASE_MONTAGE_JOB: MontageJob = {
  id: 'job-0002',
  kind: 'montage',
  slug: 'smoke-ingest',
  state: 'running',
  createdAt: '2026-09-09T10:00:00.000Z',
  startedAt: '2026-09-09T10:00:01.000Z',
  finishedAt: null,
  progress: { stage: 'transcribe', processedAssets: 2, totalAssets: 6, percent: 33.3 },
  report: null,
  error: null,
};

function montageProgressAt(stage: MontageJobProgress['stage']): MontageJobProgress {
  return { stage, processedAssets: null, totalAssets: null, percent: null };
}

describe('isJobKind', () => {
  it('accepts the two kinds the queue publishes', () => {
    expect(isJobKind('render')).toBe(true);
    expect(isJobKind('montage')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isJobKind('ingest')).toBe(false);
    expect(isJobKind(null)).toBe(false);
  });
});

describe('isMontageStage', () => {
  it('accepts the four montage stages and no render stage', () => {
    for (const stage of ['discover', 'probe', 'transcribe', 'plan']) {
      expect(isMontageStage(stage)).toBe(true);
    }
    expect(isMontageStage('render')).toBe(false);
    expect(isMontageStage('mux')).toBe(false);
  });
});

describe('showsAssetProgress', () => {
  it('is true only for the two stages that carry a counter (EP-014)', () => {
    expect(showsAssetProgress(montageProgressAt('probe'))).toBe(true);
    expect(showsAssetProgress(montageProgressAt('transcribe'))).toBe(true);
  });

  it('is false for discover and plan, which never carry a count', () => {
    expect(showsAssetProgress(montageProgressAt('discover'))).toBe(false);
    expect(showsAssetProgress(montageProgressAt('plan'))).toBe(false);
    expect(showsAssetProgress(null)).toBe(false);
  });
});

describe('parseJob', () => {
  it('narrows a render job and a montage job through the same entry point', () => {
    expect(parseJob(BASE_JOB)).toEqual(BASE_JOB);
    expect(parseJob(BASE_MONTAGE_JOB)).toEqual(BASE_MONTAGE_JOB);
  });

  it('publishes exactly the keys EP-014 documents, for both kinds', () => {
    const documented = [
      'createdAt',
      'error',
      'finishedAt',
      'id',
      'kind',
      'progress',
      'report',
      'slug',
      'startedAt',
      'state',
    ];

    expect(Object.keys(parseJob(BASE_JOB)).sort()).toEqual(documented);
    expect(Object.keys(parseJob(BASE_MONTAGE_JOB)).sort()).toEqual(documented);
  });

  it('publishes the montage progress counters EP-014 documents, never the render ones', () => {
    const progress = parseMontageJob(BASE_MONTAGE_JOB).progress as MontageJobProgress;

    expect(Object.keys(progress).sort()).toEqual([
      'percent',
      'processedAssets',
      'stage',
      'totalAssets',
    ]);
  });

  it('rejects a job whose kind is unknown', () => {
    expect(() => parseJob({ ...BASE_JOB, kind: 'ingest' })).toThrow(/a job document/);
  });

  it('rejects a montage job carrying the render counter names', () => {
    expect(() =>
      parseJob({
        ...BASE_MONTAGE_JOB,
        progress: { stage: 'probe', renderedFrames: 1, totalFrames: 6, percent: 16 },
      }),
    ).toThrow(/a job document/);
  });

  it('rejects a render job carrying a montage stage', () => {
    expect(() =>
      parseJob({
        ...BASE_JOB,
        progress: { stage: 'transcribe', renderedFrames: null, totalFrames: null, percent: null },
      }),
    ).toThrow(/a job document/);
  });
});

describe('parseMontageJob', () => {
  it('narrows a succeeded montage job carrying its report', () => {
    const succeeded: MontageJob = {
      ...BASE_MONTAGE_JOB,
      state: 'succeeded',
      progress: null,
      finishedAt: '2026-09-09T10:00:06.000Z',
      report: {
        catalogPath: 'work/catalog.json',
        timelinePath: 'work/timeline.json',
        editDecisionListPath: 'work/edl.json',
        preset: 'software-demo',
        seed: 0,
      },
    };

    expect(parseMontageJob(succeeded)).toEqual(succeeded);
    expect(Object.keys(succeeded.report ?? {}).sort()).toEqual([
      'catalogPath',
      'editDecisionListPath',
      'preset',
      'seed',
      'timelinePath',
    ]);
  });

  it('refuses a render job, so a caller cannot read montage fields off it', () => {
    expect(() => parseMontageJob(BASE_JOB)).toThrow(/a montage job document/);
  });

  it('refuses a montage job where a render job is expected', () => {
    expect(() => parseRenderJob(BASE_MONTAGE_JOB)).toThrow(/a render job document/);
  });
});

const BASE_STORYBOARD_JOB: StoryboardJob = {
  id: 'job-0009',
  kind: 'storyboard',
  slug: 'smoke-ingest',
  state: 'running',
  createdAt: '2026-09-09T12:00:00.000Z',
  startedAt: '2026-09-09T12:00:00.500Z',
  finishedAt: null,
  progress: { stage: 'propose', percent: 66 },
  report: null,
  error: null,
};

describe('parseStoryboardJob', () => {
  it('names the three stages of the storyboard pipeline and nothing else', () => {
    expect(['collect', 'propose', 'persist'].every(isStoryboardStage)).toBe(true);
    expect(isStoryboardStage('transcribe')).toBe(false);
    expect(isStoryboardStage('render')).toBe(false);
  });

  it('accepts storyboard as a third job kind of the shared union', () => {
    expect(isJobKind('storyboard')).toBe(true);
    expect(parseJob(BASE_STORYBOARD_JOB)).toEqual(BASE_STORYBOARD_JOB);
    expect(parseStoryboardJob(BASE_STORYBOARD_JOB)).toEqual(BASE_STORYBOARD_JOB);
  });

  it('accepts the full report with every key of the contract and both sources', () => {
    const succeeded: StoryboardJob = {
      ...BASE_STORYBOARD_JOB,
      state: 'succeeded',
      finishedAt: '2026-09-09T12:01:40.000Z',
      progress: { stage: 'persist', percent: 100 },
      report: {
        storyboardPath: 'work/storyboard.json',
        storyboardId: 'storyboard-0001',
        source: 'brief',
        language: 'es-AR',
        sceneCount: 8,
        usage: { tokensIn: 4200, tokensOut: 3100, costUsd: 0.31, model: 'claude-opus-4' },
      },
    };

    expect(parseStoryboardJob(succeeded)).toEqual(succeeded);
    expect(Object.keys(succeeded.report ?? {}).sort()).toEqual([
      'language',
      'sceneCount',
      'source',
      'storyboardId',
      'storyboardPath',
      'usage',
    ]);
    expect(isStoryboardJobSource('script')).toBe(true);
    expect(isStoryboardJobSource('montage')).toBe(false);
  });

  it('accepts a usage block whose cost and model the CLI did not report', () => {
    const withoutCost: StoryboardJob = {
      ...BASE_STORYBOARD_JOB,
      state: 'succeeded',
      report: {
        storyboardPath: 'work/storyboard.json',
        storyboardId: 'storyboard-0001',
        source: 'script',
        language: 'en-US',
        sceneCount: 5,
        usage: { tokensIn: 10, tokensOut: 20, costUsd: null, model: null },
      },
    };

    expect(parseStoryboardJob(withoutCost)).toEqual(withoutCost);
  });

  it('rejects a storyboard job whose progress carries a montage stage', () => {
    expect(() =>
      parseJob({ ...BASE_STORYBOARD_JOB, progress: { stage: 'transcribe', percent: 50 } }),
    ).toThrow(/a job document/);
  });

  it('refuses the other two kinds, so a caller cannot read storyboard fields off them', () => {
    expect(() => parseStoryboardJob(BASE_JOB)).toThrow(/a storyboard job document/);
    expect(() => parseRenderJob(BASE_STORYBOARD_JOB)).toThrow(/a render job document/);
    expect(() => parseMontageJob(BASE_STORYBOARD_JOB)).toThrow(/a montage job document/);
  });

  it('accepts a storyboard stage in a job summary of the listing', () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0009',
          kind: 'storyboard',
          state: 'running',
          stage: 'propose',
          errorCode: null,
          createdAt: '2026-09-09T12:00:00.000Z',
          startedAt: '2026-09-09T12:00:00.500Z',
          finishedAt: null,
        },
      ],
    };

    expect(parseRenderJobListing(listing)).toEqual(listing);
  });
});

describe('parseJob for motion jobs', () => {
  const motionJob = (report: unknown) => ({
    id: 'j1',
    slug: 'reel',
    kind: 'motion',
    state: 'succeeded',
    createdAt: '2026-10-07T16:55:18.660Z',
    startedAt: '2026-10-07T16:55:18.663Z',
    finishedAt: '2026-10-07T16:59:12.228Z',
    progress: { stage: 'storyboard', linesVoiced: null, totalLines: null, percent: 0 },
    report,
    error: null,
  });

  it('accepts the storyboard phase report, which has no video path nor duration yet', () => {
    const report = { path: null, durationSec: null, scenes: 7, storyboard: { repaired: false, tokensIn: 63189, tokensOut: 18549, costUsd: 0.44 } };
    expect(parseJob(motionJob(report))).toMatchObject({ kind: 'motion', state: 'succeeded', report });
  });

  it('accepts the video phase report with its path and duration', () => {
    const report = { path: 'out/video.mp4', durationSec: 31.2, scenes: 7, storyboard: null };
    expect(parseJob(motionJob(report))).toMatchObject({ report });
  });
});

describe('reference jobs', () => {
  it('accepts a reference job with its stage progress', () => {
    expect(isJobKind('reference')).toBe(true);
    expect(parseJob(referenceJob()).kind).toBe('reference');
  });

  it('rejects a reference job with an unknown stage', () => {
    expect(() => parseJob(referenceJob({ progress: { stage: 'nope' as 'probe', percent: 1 } }))).toThrow();
  });

  it('accepts a job listing entry in a reference stage', () => {
    const listing = {
      slug: 'demo',
      jobs: [
        {
          id: 'j1',
          kind: 'reference',
          state: 'running',
          stage: 'keyframes',
          errorCode: null,
          createdAt: '2026-10-12T10:00:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
      ],
    };

    expect(parseRenderJobListing(listing).jobs[0]?.stage).toBe('keyframes');
  });
});
