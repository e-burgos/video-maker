import type { JobRecord } from '@video-maker/local-store';
import { describe, expect, it } from 'vitest';

import { historySampleFrom, historySamplesFrom } from './job-history';

function row(overrides: Partial<JobRecord>): JobRecord {
  return {
    id: 'job-1',
    slug: 'video-a',
    kind: 'render',
    state: 'succeeded',
    params: { kind: 'render', timeline: { format: { preset: 'youtube-16x9' } } },
    progress: null,
    report: { deliverable: { durationInFrames: 900, fps: 30 } },
    error: null,
    retryOf: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    startedAt: '2026-10-01T10:00:10.000Z',
    finishedAt: '2026-10-01T10:01:10.000Z',
    ...overrides,
  };
}

describe('historySampleFrom', () => {
  it('reads a render as footage seconds of video against seconds of process, with its format', () => {
    expect(historySampleFrom(row({}))).toEqual({
      kind: 'render',
      mode: 'footage',
      format: 'youtube-16x9',
      mediaSec: 30,
      processSec: 60,
      finishedAt: '2026-10-01T10:01:10.000Z',
    });
  });

  it('reads a motion video with its duration and no format', () => {
    const sample = historySampleFrom(row({ kind: 'motion', params: { phase: 'all' }, report: { path: 'out/video.mp4', durationSec: 80 } }));

    expect(sample).toMatchObject({ kind: 'render', mode: 'motion', format: null, mediaSec: 80, processSec: 60 });
  });

  it('skips a motion storyboard-only job, which has no duration', () => {
    expect(historySampleFrom(row({ kind: 'motion', report: { path: null, durationSec: null } }))).toBeNull();
  });

  it('reads a voice job from its track, or from its scenes when it has no track', () => {
    expect(historySampleFrom(row({ kind: 'voice', report: { track: { durationMs: 20000 }, scenes: [] } }))).toMatchObject({ kind: 'voice', mediaSec: 20 });
    expect(historySampleFrom(row({ kind: 'voice', report: { track: null, scenes: [{ durationMs: 3000 }, { durationMs: 2000 }] } }))).toMatchObject({ mediaSec: 5 });
  });

  it.each([
    ['a failed job', { state: 'failed' }],
    ['a sample', { report: { sample: true, deliverable: { durationInFrames: 300, fps: 30 } } }],
    ['a job without start', { startedAt: null }],
    ['a job without report', { report: null }],
    ['a kind outside the history', { kind: 'montage' }],
  ])('skips %s', (_label, overrides) => {
    expect(historySampleFrom(row(overrides))).toBeNull();
  });

  it('keeps only the rows it can read', () => {
    expect(historySamplesFrom([row({}), row({ state: 'failed' })])).toHaveLength(1);
  });
});
