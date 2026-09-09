import { describe, expect, it } from 'vitest';

import {
  isRenderJobState,
  isRenderPipelineStage,
  isTerminalRenderJobState,
  parseRenderJob,
  parseRenderJobListing,
  showsFrameProgress,
} from './parse-render-job';
import type { RenderJob, RenderJobProgress } from './render-api-types';

const BASE_JOB: RenderJob = {
  id: 'job-0001',
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
    expect(() => parseRenderJob({ id: 'job-0001' })).toThrow(/a render job document/);

    try {
      parseRenderJob(null);
    } catch (error) {
      expect(error).toMatchObject({ code: 'RESPONSE_SHAPE_UNEXPECTED', status: 200 });
    }
  });
});

describe('parseRenderJobListing', () => {
  it('narrows a listing of job summaries', () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0001',
          state: 'queued' as const,
          stage: null,
          errorCode: null,
          createdAt: '2026-09-09T10:00:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
        {
          id: 'job-0002',
          state: 'running' as const,
          stage: 'render' as const,
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
