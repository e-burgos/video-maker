import { describe, expect, it } from 'vitest';

import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import type { Job, MontageJob, MontageJobReport, RenderJob } from './render-job';
import { toJob, toJobSummary } from './render-job';

interface RenderJobRecordLike extends RenderJob {
  readonly projectRoot: string;
  readonly timeline: unknown;
}

interface MontageJobRecordLike extends MontageJob {
  readonly projectRoot: string;
}

const SAMPLE_RENDER_REPORT: RenderPipelineReport = {
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

const SAMPLE_MONTAGE_REPORT: MontageJobReport = {
  catalogPath: 'work/catalog.json',
  timelinePath: 'work/timeline.json',
  editDecisionListPath: 'work/edl.json',
  preset: 'software-demo',
  seed: 0,
};

const SAMPLE_ERROR: RenderApiErrorPayload = {
  code: 'MEDIA_COMMAND_FAILED',
  stage: 'mix',
  message: 'A media command exited with a non-zero status.',
  resource: 'work/renders/render-0002/master.wav',
};

function buildRenderRecordLike(overrides: Partial<RenderJob> = {}): RenderJobRecordLike {
  return {
    id: 'render-0001',
    slug: 'smoke-ingest',
    kind: 'render',
    state: 'succeeded',
    createdAt: '2026-09-08T00:00:00.000Z',
    startedAt: '2026-09-08T00:00:00.000Z',
    finishedAt: '2026-09-08T00:04:11.000Z',
    progress: { stage: 'verify', renderedFrames: null, totalFrames: null, percent: null },
    report: SAMPLE_RENDER_REPORT,
    error: null,
    projectRoot: '/var/data/media/smoke-ingest',
    timeline: { note: 'not read by the projection' },
    ...overrides,
  };
}

function buildMontageRecordLike(overrides: Partial<MontageJob> = {}): MontageJobRecordLike {
  return {
    id: 'montage-0001',
    slug: 'smoke-montage',
    kind: 'montage',
    state: 'succeeded',
    createdAt: '2026-09-08T00:00:00.000Z',
    startedAt: '2026-09-08T00:00:00.000Z',
    finishedAt: '2026-09-08T00:04:11.000Z',
    progress: { stage: 'plan', processedAssets: null, totalAssets: null, percent: null },
    report: SAMPLE_MONTAGE_REPORT,
    error: null,
    projectRoot: '/var/data/media/smoke-montage',
    ...overrides,
  };
}

describe('toJob', () => {
  it('never projects projectRoot or timeline into a render job body', () => {
    const record = buildRenderRecordLike();

    const job = toJob(record);

    expect(job).toEqual({
      id: 'render-0001',
      slug: 'smoke-ingest',
      kind: 'render',
      state: 'succeeded',
      createdAt: '2026-09-08T00:00:00.000Z',
      startedAt: '2026-09-08T00:00:00.000Z',
      finishedAt: '2026-09-08T00:04:11.000Z',
      progress: { stage: 'verify', renderedFrames: null, totalFrames: null, percent: null },
      report: SAMPLE_RENDER_REPORT,
      error: null,
    });
    expect(Object.keys(job)).not.toContain('projectRoot');
    expect(Object.keys(job)).not.toContain('timeline');
  });

  it('never projects projectRoot into a montage job body', () => {
    const record = buildMontageRecordLike();

    const job = toJob(record);

    expect(job).toEqual({
      id: 'montage-0001',
      slug: 'smoke-montage',
      kind: 'montage',
      state: 'succeeded',
      createdAt: '2026-09-08T00:00:00.000Z',
      startedAt: '2026-09-08T00:00:00.000Z',
      finishedAt: '2026-09-08T00:04:11.000Z',
      progress: { stage: 'plan', processedAssets: null, totalAssets: null, percent: null },
      report: SAMPLE_MONTAGE_REPORT,
      error: null,
    });
    expect(Object.keys(job)).not.toContain('projectRoot');
  });

  it('never lets a render field leak into a montage job nor vice versa', () => {
    const renderJob: Job = toJob(buildRenderRecordLike());
    const montageJob: Job = toJob(buildMontageRecordLike());

    expect(renderJob.kind).toBe('render');
    expect(montageJob.kind).toBe('montage');
    expect(Object.keys(renderJob).sort()).toEqual(Object.keys(montageJob).sort());
  });

  it('preserves the seven JobBase fields by name and value for a render job', () => {
    const record = buildRenderRecordLike();

    const job = toJob(record);

    expect(job.id).toBe(record.id);
    expect(job.slug).toBe(record.slug);
    expect(job.state).toBe(record.state);
    expect(job.createdAt).toBe(record.createdAt);
    expect(job.startedAt).toBe(record.startedAt);
    expect(job.finishedAt).toBe(record.finishedAt);
    expect(job.error).toBe(record.error);
  });
});

describe('toJobSummary', () => {
  it('projects a render job to a summary with kind, id, state, stage and errorCode', () => {
    const job = toJob(buildRenderRecordLike({ state: 'failed', report: null, error: SAMPLE_ERROR }));

    const summary = toJobSummary(job);

    expect(summary).toEqual({
      id: 'render-0001',
      kind: 'render',
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

  it('projects a montage job to a summary with its own stage type', () => {
    const job = toJob(buildMontageRecordLike({ progress: { stage: 'probe', processedAssets: 2, totalAssets: 5, percent: 40 } }));

    const summary = toJobSummary(job);

    expect(summary).toEqual({
      id: 'montage-0001',
      kind: 'montage',
      state: 'succeeded',
      stage: 'probe',
      errorCode: null,
      createdAt: '2026-09-08T00:00:00.000Z',
      startedAt: '2026-09-08T00:00:00.000Z',
      finishedAt: '2026-09-08T00:04:11.000Z',
    });
  });

  it('answers a null stage and errorCode when the job has no progress or error', () => {
    const job = toJob(buildRenderRecordLike({ progress: null, error: null }));

    const summary = toJobSummary(job);

    expect(summary.stage).toBeNull();
    expect(summary.errorCode).toBeNull();
  });
});
