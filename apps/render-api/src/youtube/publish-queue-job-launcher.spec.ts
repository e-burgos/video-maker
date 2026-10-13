import type { PublishQueueRecord } from '@video-maker/local-store';
import { describe, expect, it } from 'vitest';

import { publishQueueItemToJobBody } from './publish-queue-job-launcher';
import { parsePublishJobInput } from '../jobs/publish-job-params';

function item(metadata: Record<string, unknown>): PublishQueueRecord {
  return {
    id: 'i',
    slug: 'promo',
    file: 'out/video.mp4',
    metadata: { title: 'T', description: '', tags: [], privacy: 'public', ...metadata },
    position: 0,
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    jobId: null,
    url: null,
    createdAt: 'x',
    updatedAt: 'x',
  };
}

describe('publishQueueItemToJobBody', () => {
  const now = Date.parse('2026-10-13T10:00:00.000Z');

  it('does not ignore the review by default', () => {
    const input = parsePublishJobInput(publishQueueItemToJobBody(item({}), ['PL1']), now);

    expect(input.ignoreReview).toBe(false);
    expect(input.playlistIds).toEqual(['PL1']);
  });

  it('passes ignoreReview through to the publish job input', () => {
    const input = parsePublishJobInput(publishQueueItemToJobBody(item({ ignoreReview: true }), []), now);

    expect(input.ignoreReview).toBe(true);
  });
});
