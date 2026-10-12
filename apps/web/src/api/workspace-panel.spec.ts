import { describe, expect, it } from 'vitest';

import { assetEntry, assetListing, jobListing, pendingJob, succeededJob } from './__fixtures__/workspace';
import {
  fullRenderJobsNewestFirst,
  groupAssetsByRole,
  latestSucceededJobOfKind,
  succeededJobsOfKindNewestFirst,
  tabForNewlySucceededJob,
} from './workspace-panel';

describe('groupAssetsByRole', () => {
  it('returns nothing for an empty or missing listing', () => {
    expect(groupAssetsByRole(null)).toEqual([]);
    expect(groupAssetsByRole(assetListing([]))).toEqual([]);
  });

  it('groups by role in the canonical importance order, skipping roles with no assets', () => {
    const logo = assetEntry({ path: 'raw/logo/mark.png', role: 'logo' });
    const aroll1 = assetEntry({ path: 'raw/aroll/a1.mp4', role: 'aroll' });
    const aroll2 = assetEntry({ path: 'raw/aroll/a2.mp4', role: 'aroll' });

    const groups = groupAssetsByRole(assetListing([logo, aroll1, aroll2]));

    expect(groups.map((group) => group.role)).toEqual(['aroll', 'logo']);
    expect(groups[0]?.assets).toEqual([aroll1, aroll2]);
    expect(groups[1]?.assets).toEqual([logo]);
  });
});

describe('succeededJobsOfKindNewestFirst', () => {
  it('is empty when there is no listing or no matching job', () => {
    expect(succeededJobsOfKindNewestFirst(null, 'render')).toEqual([]);
    expect(
      succeededJobsOfKindNewestFirst(jobListing([pendingJob('render', 'job-1')]), 'render'),
    ).toEqual([]);
  });

  it('keeps only succeeded jobs of the requested kind, newest finishedAt first', () => {
    const older = succeededJob('render', 'job-older', '2026-09-10T10:00:00.000Z');
    const newer = succeededJob('render', 'job-newer', '2026-09-11T10:00:00.000Z');
    const otherKind = succeededJob('montage', 'job-montage', '2026-09-12T10:00:00.000Z');

    const result = succeededJobsOfKindNewestFirst(jobListing([older, newer, otherKind]), 'render');

    expect(result.map((job) => job.id)).toEqual(['job-newer', 'job-older']);
  });

  it('falls back to createdAt when finishedAt is missing', () => {
    const job = succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z');
    const withoutFinish = { ...job, finishedAt: null };

    expect(succeededJobsOfKindNewestFirst(jobListing([withoutFinish]), 'render')).toEqual([
      withoutFinish,
    ]);
  });
});

describe('latestSucceededJobOfKind', () => {
  it('returns null when nothing succeeded yet', () => {
    expect(latestSucceededJobOfKind(jobListing([pendingJob('render', 'job-1')]), 'render')).toBeNull();
  });

  it('returns the newest succeeded job of that kind', () => {
    const older = succeededJob('render', 'job-older', '2026-09-10T10:00:00.000Z');
    const newer = succeededJob('render', 'job-newer', '2026-09-11T10:00:00.000Z');

    expect(latestSucceededJobOfKind(jobListing([older, newer]), 'render')?.id).toBe('job-newer');
  });
});

describe('tabForNewlySucceededJob', () => {
  it('is null when nothing changed', () => {
    const jobs = jobListing([pendingJob('render', 'job-1')]);
    expect(tabForNewlySucceededJob(jobs, jobs)).toBeNull();
  });

  it('treats a job absent from the previous snapshot as newly succeeded', () => {
    const previous = jobListing([]);
    const current = jobListing([succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z')]);

    expect(tabForNewlySucceededJob(previous, current)).toBe('deliveries');
  });

  it('switches to deliveries when a render job newly succeeds', () => {
    const previous = jobListing([pendingJob('render', 'job-1')]);
    const current = jobListing([succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z')]);

    expect(tabForNewlySucceededJob(previous, current)).toBe('deliveries');
  });

  it('switches to preview when a montage job newly succeeds', () => {
    const previous = jobListing([pendingJob('montage', 'job-1')]);
    const current = jobListing([succeededJob('montage', 'job-1', '2026-09-10T10:00:00.000Z')]);

    expect(tabForNewlySucceededJob(previous, current)).toBe('preview');
  });

  it('ignores job kinds that have no tab, like storyboard or voice', () => {
    const previous = jobListing([pendingJob('storyboard', 'job-1')]);
    const current = jobListing([succeededJob('storyboard', 'job-1', '2026-09-10T10:00:00.000Z')]);

    expect(tabForNewlySucceededJob(previous, current)).toBeNull();
  });

  it('does not re-trigger for a job that was already succeeded', () => {
    const job = succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z');
    const previous = jobListing([job]);
    const current = jobListing([job]);

    expect(tabForNewlySucceededJob(previous, current)).toBeNull();
  });
});

describe('fullRenderJobsNewestFirst', () => {
  const listing = jobListing([
    succeededJob('render', 'job-0001', '2026-09-10T10:00:00.000Z'),
    succeededJob('render', 'job-0002', '2026-09-10T11:00:00.000Z'),
  ]);

  it('keeps every succeeded render when the generated listing is not known yet', () => {
    expect(fullRenderJobsNewestFirst(listing, null).map((job) => job.id)).toEqual(['job-0002', 'job-0001']);
  });

  it('drops renders without a full output, which are samples', () => {
    const generated = {
      slug: 'demo-01',
      roots: ['out'],
      files: [
        { path: 'out/job-0001.mp4', sizeBytes: 1, modifiedAtMs: 1 },
        { path: 'out/job-0002.sample.mp4', sizeBytes: 1, modifiedAtMs: 2 },
      ],
    };

    expect(fullRenderJobsNewestFirst(listing, generated).map((job) => job.id)).toEqual(['job-0001']);
  });
});
