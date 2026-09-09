import { describe, expect, it } from 'vitest';

import { renderJobDeliverableUrl } from './render-job-artifact';
import type { RenderJob } from './render-api-types';

const SUCCEEDED_JOB: RenderJob = {
  id: 'job-0001',
  slug: 'smoke-ingest',
  state: 'succeeded',
  createdAt: '2026-09-09T10:00:00.000Z',
  startedAt: '2026-09-09T10:00:01.000Z',
  finishedAt: '2026-09-09T10:01:00.000Z',
  progress: null,
  error: null,
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

describe('renderJobDeliverableUrl', () => {
  it('builds the out/<jobId>.mp4 artifact url for the project', () => {
    expect(renderJobDeliverableUrl('smoke-ingest', 'job-0001')).toBe(
      '/api/projects/smoke-ingest/files/out/job-0001.mp4',
    );
  });

  it('percent-encodes the slug and the job id segments', () => {
    expect(renderJobDeliverableUrl('a b', 'job 01')).toBe('/api/projects/a%20b/files/out/job%2001.mp4');
  });

  it('matches report.deliverable.resource of a succeeded job fixture', () => {
    const url = renderJobDeliverableUrl(SUCCEEDED_JOB.slug, SUCCEEDED_JOB.id);

    expect(url).toBe(`/api/projects/${SUCCEEDED_JOB.slug}/files/${SUCCEEDED_JOB.report?.deliverable.resource}`);
  });
});
