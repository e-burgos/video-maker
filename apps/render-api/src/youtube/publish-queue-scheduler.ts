import type { PublishQueueRecord } from '@video-maker/local-store';

import type { Clock, LocalStorePort } from '../deps/render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { Job } from '../jobs/render-job';
import { isTerminalRenderJobState } from '../jobs/render-job';
import { readCategoryPlaylistSettings, readPublishQueueSettings, writePublishQueueSettings } from './publish-queue-settings';

export const PUBLISH_QUEUE_TICK_MS = 60_000;
export const PUBLISH_QUEUE_JOB_WATCH_MS = 5_000;
export const QUOTA_RETRY_DELAY_MS = 60 * 60 * 1000;
export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const BLOCKING_PUBLICATION_STATUSES = ['published', 'scheduled', 'uploading'] as const;
const COUNTED_PUBLICATION_STATUSES = ['published', 'scheduled'] as const;
const NOT_CONNECTED_CODES: readonly string[] = ['YOUTUBE_NOT_CONNECTED', 'YOUTUBE_CLIENT_MISSING'];

export interface PublishQueueTimer {
  readonly every: (intervalMs: number, callback: () => void) => () => void;
  readonly after: (delayMs: number, callback: () => void) => () => void;
}

export interface PublishQueueSchedulerDeps {
  readonly localStore: Pick<LocalStorePort, 'publishQueue' | 'publications' | 'settings' | 'jobs' | 'organization'>;
  readonly clock: Clock;
  readonly timer: PublishQueueTimer;
  readonly jobs: { readonly get: (jobId: string) => Job | null };
  readonly launchPublishJob: (item: PublishQueueRecord, playlistIds: readonly string[]) => Promise<Job>;
}

export interface PublishQueueScheduler {
  readonly start: () => void;
  readonly stop: () => void;
  readonly poke: () => Promise<void>;
}

export interface ExistingPublication {
  readonly url: string | null;
}

export function findExistingPublication(
  publications: LocalStorePort['publications'],
  slug: string,
  file: string,
): ExistingPublication | null {
  const existing = publications
    .listByProject(slug)
    .find((record) => record.file === file && (BLOCKING_PUBLICATION_STATUSES as readonly string[]).includes(record.status));
  return existing === undefined ? null : { url: existing.url };
}

export function countPublishedInLastDay(publications: LocalStorePort['publications'], nowMs: number): number {
  return publications.countCreatedSince(new Date(nowMs - DAILY_WINDOW_MS).toISOString(), COUNTED_PUBLICATION_STATUSES);
}

export function createRealPublishQueueTimer(): PublishQueueTimer {
  return {
    every: (intervalMs, callback) => {
      const handle = setInterval(callback, intervalMs);
      handle.unref();
      return () => {
        clearInterval(handle);
      };
    },
    after: (delayMs, callback) => {
      const handle = setTimeout(callback, delayMs);
      handle.unref();
      return () => {
        clearTimeout(handle);
      };
    },
  };
}

function toPayload(cause: unknown): RenderApiErrorPayload {
  return toErrorPayload(cause);
}

export function createPublishQueueScheduler(deps: PublishQueueSchedulerDeps): PublishQueueScheduler {
  const { publishQueue, publications, settings, jobs: jobsStore, organization } = deps.localStore;
  let stopTick: (() => void) | null = null;
  let stopWatch: (() => void) | null = null;
  let running: Promise<void> | null = null;
  let rerun = false;

  const nowMs = (): number => Date.parse(deps.clock.nowIso());
  const nowIso = (): string => deps.clock.nowIso();
  const isoAfter = (delayMs: number): string => new Date(nowMs() + delayMs).toISOString();

  function pause(): void {
    writePublishQueueSettings(settings, { ...readPublishQueueSettings(settings), paused: true });
  }

  function resolvePlaylistIds(item: PublishQueueRecord): readonly string[] {
    const own = item.metadata.playlistIds ?? [];
    if (own.length > 0) {
      return own;
    }
    const { categoryPlaylists, generalPlaylistId } = readCategoryPlaylistSettings(settings);
    const categoryId = organization.getOrganization().videos[item.slug]?.categoryId ?? null;
    const categoryPlaylist = categoryId === null ? undefined : categoryPlaylists[categoryId];
    return [...new Set([categoryPlaylist, generalPlaylistId].filter((id): id is string => id !== undefined && id !== null))];
  }

  function delayQueuedItems(untilIso: string): void {
    for (const item of publishQueue.list()) {
      if (item.status === 'queued' && (item.nextAttemptAt === null || item.nextAttemptAt < untilIso)) {
        publishQueue.update(item.id, { nextAttemptAt: untilIso, updatedAt: nowIso() });
      }
    }
  }

  function requeueAfterQuota(item: PublishQueueRecord, error: RenderApiErrorPayload): void {
    const retryAt = isoAfter(QUOTA_RETRY_DELAY_MS);
    publishQueue.update(item.id, {
      status: 'queued',
      attempts: item.attempts + 1,
      lastError: error,
      nextAttemptAt: retryAt,
      jobId: null,
      updatedAt: nowIso(),
    });
    delayQueuedItems(retryAt);
  }

  function settleFailure(item: PublishQueueRecord, error: RenderApiErrorPayload): void {
    if (error.code === 'YOUTUBE_QUOTA_EXCEEDED') {
      requeueAfterQuota(item, error);
      return;
    }
    if (NOT_CONNECTED_CODES.includes(error.code)) {
      publishQueue.update(item.id, { status: 'queued', lastError: error, jobId: null, updatedAt: nowIso() });
      pause();
      return;
    }
    publishQueue.update(item.id, { status: 'failed', lastError: error, jobId: null, updatedAt: nowIso() });
  }

  function reconcilePublishing(): void {
    for (const item of publishQueue.list()) {
      if (item.status !== 'publishing') {
        continue;
      }
      const job = item.jobId === null ? null : deps.jobs.get(item.jobId);
      if (job === null) {
        publishQueue.update(item.id, { status: 'queued', jobId: null, updatedAt: nowIso() });
        continue;
      }
      if (!isTerminalRenderJobState(job.state)) {
        continue;
      }
      if (job.kind === 'publish' && job.state === 'succeeded' && job.report !== null) {
        publishQueue.update(item.id, { status: 'published', url: job.report.url, lastError: null, updatedAt: nowIso() });
        continue;
      }
      const error: RenderApiErrorPayload = job.error ?? {
        code: 'JOB_INTERRUPTED',
        stage: null,
        message: `The publish job ended as ${job.state}.`,
      };
      settleFailure(item, error);
    }
  }

  function hasUnfinishedPublishJob(): boolean {
    return jobsStore.listUnfinished().some((job) => job.kind === 'publish');
  }

  function publishedInLastDay(): number {
    return countPublishedInLastDay(publications, nowMs());
  }

  async function launchNextDueItem(): Promise<void> {
    for (;;) {
      const queueSettings = readPublishQueueSettings(settings);
      if (queueSettings.paused || hasUnfinishedPublishJob() || publishedInLastDay() >= queueSettings.dailyLimit) {
        return;
      }
      const item = publishQueue.nextDue(nowIso());
      if (item === null) {
        return;
      }
      const existing = findExistingPublication(publications, item.slug, item.file);
      if (existing !== null) {
        publishQueue.update(item.id, { status: 'already-published', url: existing.url, lastError: null, updatedAt: nowIso() });
        continue;
      }
      try {
        const job = await deps.launchPublishJob(item, resolvePlaylistIds(item));
        publishQueue.update(item.id, { status: 'publishing', jobId: job.id, updatedAt: nowIso() });
        return;
      } catch (cause) {
        settleFailure(item, toPayload(cause));
      }
    }
  }

  function armJobWatch(): void {
    stopWatch?.();
    stopWatch = null;
    if (publishQueue.list().some((item) => item.status === 'publishing')) {
      stopWatch = deps.timer.after(PUBLISH_QUEUE_JOB_WATCH_MS, () => {
        void poke();
      });
    }
  }

  async function runOnce(): Promise<void> {
    reconcilePublishing();
    await launchNextDueItem();
    armJobWatch();
  }

  function poke(): Promise<void> {
    if (running !== null) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerun = false;
          await runOnce();
        } while (rerun);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  function start(): void {
    for (const item of publishQueue.list()) {
      const job = item.jobId === null ? null : deps.jobs.get(item.jobId);
      if (item.status === 'publishing' && (job === null || isTerminalRenderJobState(job.state))) {
        publishQueue.update(item.id, { status: 'queued', jobId: null, updatedAt: nowIso() });
      }
    }
    stopTick = deps.timer.every(PUBLISH_QUEUE_TICK_MS, () => {
      void poke();
    });
    void poke();
  }

  function stop(): void {
    stopTick?.();
    stopTick = null;
    stopWatch?.();
    stopWatch = null;
  }

  return { start, stop, poke };
}
