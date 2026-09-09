import { describe, expect, it } from 'vitest';

import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import type { RenderJob } from './render-job';
import { toRenderJob, toRenderJobSummary } from './render-job';

interface RenderJobRecordLike extends RenderJob {
  readonly projectRoot: string;
  readonly timeline: unknown;
}

const SAMPLE_REPORT: RenderPipelineReport = {
  renderId: 'render-0001',
  startedAt: '2026-09-08T00:00:00.000Z',
  finishedAt: '2026-09-08T00:04:11.000Z',
  deliverable: {
    resource: 'out/render-0001.mp4',
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 538,
  },
  intermediates: {
    mutedVideoResource: 'work/renders/render-0001/video-muted.mp4',
    masterAudioResource: 'work/renders/render-0001/master.wav',
  },
  loudness: {
    withinTolerance: true,
    integratedLufs: -14.1,
    truePeakDbtp: -1.4,
    integratedDeltaLu: -0.1,
    truePeakDeltaDb: -0.4,
  },
};

const SAMPLE_ERROR: RenderApiErrorPayload = {
  code: 'MEDIA_COMMAND_FAILED',
  stage: 'mix',
  message: 'A media command exited with a non-zero status.',
  resource: 'work/renders/render-0002/master.wav',
};

function buildRecordLikeJob(overrides: Partial<RenderJob> = {}): RenderJobRecordLike {
  return {
    id: 'render-0001',
    slug: 'smoke-ingest',
    state: 'succeeded',
    createdAt: '2026-09-08T00:00:00.000Z',
    startedAt: '2026-09-08T00:00:00.000Z',
    finishedAt: '2026-09-08T00:04:11.000Z',
    progress: { stage: 'verify', renderedFrames: null, totalFrames: null, percent: null },
    report: SAMPLE_REPORT,
    error: null,
    projectRoot: '/var/data/media/smoke-ingest',
    timeline: { note: 'not read by the projection' },
    ...overrides,
  };
}

describe('toRenderJob', () => {
  it('never projects projectRoot or timeline into the job body', () => {
    const record = buildRecordLikeJob();

    const job = toRenderJob(record);

    expect(job).toEqual({
      id: 'render-0001',
      slug: 'smoke-ingest',
      state: 'succeeded',
      createdAt: '2026-09-08T00:00:00.000Z',
      startedAt: '2026-09-08T00:00:00.000Z',
      finishedAt: '2026-09-08T00:04:11.000Z',
      progress: { stage: 'verify', renderedFrames: null, totalFrames: null, percent: null },
      report: SAMPLE_REPORT,
      error: null,
    });
    expect(Object.keys(job)).not.toContain('projectRoot');
    expect(Object.keys(job)).not.toContain('timeline');
  });
});

describe('toRenderJobSummary', () => {
  it('projects a job to a summary with id, state, stage and errorCode and without report, timeline or projectRoot', () => {
    const job = toRenderJob(buildRecordLikeJob({ state: 'failed', report: null, error: SAMPLE_ERROR }));

    const summary = toRenderJobSummary(job);

    expect(summary).toEqual({
      id: 'render-0001',
      state: 'failed',
      stage: 'verify',
      errorCode: 'MEDIA_COMMAND_FAILED',
      createdAt: '2026-09-08T00:00:00.000Z',
      startedAt: '2026-09-08T00:00:00.000Z',
      finishedAt: '2026-09-08T00:04:11.000Z',
    });
    expect(summary).not.toHaveProperty('report');
    expect(summary).not.toHaveProperty('timeline');
    expect(summary).not.toHaveProperty('projectRoot');
  });

  it('answers a null stage and errorCode when the job has no progress or error', () => {
    const job = toRenderJob(buildRecordLikeJob({ progress: null, error: null }));

    const summary = toRenderJobSummary(job);

    expect(summary.stage).toBeNull();
    expect(summary.errorCode).toBeNull();
  });
});
