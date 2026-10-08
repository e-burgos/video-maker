import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { recoverInterruptedJobs } from './render-job-queue';

describe('recoverInterruptedJobs with publications', () => {
  it('marks the uploading publication of an interrupted publish job as failed', () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    deps.localStore.projects.insert('promo');
    deps.localStore.jobs.insert({
      id: 'job-1',
      slug: 'promo',
      kind: 'publish',
      state: 'running',
      params: {},
      createdAt: '2026-10-08T10:00:00.000Z',
    });
    deps.localStore.publications.insert({
      id: 'pub-1',
      slug: 'promo',
      platform: 'youtube',
      file: 'out/video.mp4',
      title: 'T',
      privacy: 'public',
      status: 'uploading',
      publishAt: null,
      jobId: 'job-1',
      createdAt: '2026-10-08T10:00:00.000Z',
    });

    recoverInterruptedJobs(deps);

    expect(deps.localStore.publications.get('pub-1')?.status).toBe('failed');
    expect(deps.localStore.jobs.get('job-1')?.state).toBe('failed');
  });
});
