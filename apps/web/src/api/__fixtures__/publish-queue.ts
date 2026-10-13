import type { PublishQueue, PublishQueueItem } from '../publish-queue-types';

export function queueItem(overrides: Partial<PublishQueueItem> = {}): PublishQueueItem {
  return {
    id: 'item-1',
    slug: 'demo',
    file: 'out/demo.mp4',
    metadata: { title: 'Demo title', description: '', tags: [], privacy: 'public' },
    position: 0,
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    jobId: null,
    url: null,
    ...overrides,
  };
}

export function publishQueue(items: PublishQueueItem[], overrides: Partial<PublishQueue> = {}): PublishQueue {
  return {
    settings: { paused: false, dailyLimit: 10 },
    publishedLast24h: 3,
    nextAttemptAt: null,
    items,
    ...overrides,
  };
}
