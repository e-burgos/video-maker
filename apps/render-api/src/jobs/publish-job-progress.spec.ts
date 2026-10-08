import { describe, expect, it } from 'vitest';

import { completePublishJobProgress, mergePublishUploadProgress, startPublishJobStage } from './publish-job-progress';

describe('publish job progress', () => {
  it('starts at prepare with 0 percent and moves forward only', () => {
    const prepare = startPublishJobStage(null, 'prepare');
    const upload = startPublishJobStage(prepare, 'upload');

    expect(prepare).toEqual({ stage: 'prepare', uploadedBytes: null, totalBytes: null, percent: 0 });
    expect(upload).toMatchObject({ stage: 'upload', uploadedBytes: 0, percent: 0 });
    expect(startPublishJobStage(upload, 'prepare')).toBe(upload);
  });

  it('computes the upload percent by bytes and never reaches 100 before completion', () => {
    const upload = startPublishJobStage(startPublishJobStage(null, 'prepare'), 'upload');

    expect(mergePublishUploadProgress(upload, 5, 10)).toMatchObject({ uploadedBytes: 5, totalBytes: 10, percent: 50 });
    expect(mergePublishUploadProgress(upload, 10, 10).percent).toBe(99);
  });

  it('keeps the thumbnail and playlist stages at 99 and completes at 100', () => {
    const thumbnail = startPublishJobStage(mergePublishUploadProgress(null, 10, 10), 'thumbnail');

    expect(thumbnail).toMatchObject({ stage: 'thumbnail', percent: 99, totalBytes: 10 });
    expect(mergePublishUploadProgress(thumbnail, 1, 10)).toBe(thumbnail);
    expect(completePublishJobProgress(thumbnail)?.percent).toBe(100);
    expect(completePublishJobProgress(null)).toBeNull();
  });
});
