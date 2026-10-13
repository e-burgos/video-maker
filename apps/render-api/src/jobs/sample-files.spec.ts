import { describe, expect, it } from 'vitest';

import type { Job } from './render-job';
import { createSampleFileClassifier, sampleFileClassifierFor } from './sample-files';

function renderJob(resource: string, sample: boolean): Job {
  return { kind: 'render', report: { deliverable: { resource }, ...(sample ? { sample: true } : {}) } } as unknown as Job;
}

function motionJob(path: string | null, sample: boolean): Job {
  return { kind: 'motion', report: { path, ...(sample ? { sample: true } : {}) } } as unknown as Job;
}

describe('createSampleFileClassifier', () => {
  it('trusts the report of the job that produced the file over its name', () => {
    const isSample = createSampleFileClassifier([renderJob('out/job-0001.mp4', true), renderJob('out/job-0002.sample.mp4', false)]);

    expect(isSample('out/job-0001.mp4')).toBe(true);
    expect(isSample('out/job-0002.sample.mp4')).toBe(false);
  });

  it('reads motion jobs by their report path', () => {
    const isSample = createSampleFileClassifier([motionJob('out/promo.mp4', true), motionJob(null, false)]);

    expect(isSample('out/promo.mp4')).toBe(true);
  });

  it('falls back to the .sample.mp4 suffix only for files without a known job', () => {
    const isSample = createSampleFileClassifier([renderJob('out/job-0001.mp4', false)]);

    expect(isSample('out/old.sample.mp4')).toBe(true);
    expect(isSample('out/old.mp4')).toBe(false);
  });

  it('classifies by suffix when no jobs source is given', () => {
    const isSample = sampleFileClassifierFor(undefined, 'promo');

    expect(isSample('out/a.sample.mp4')).toBe(true);
    expect(isSample('out/a.mp4')).toBe(false);
  });
});
