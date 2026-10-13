import { beforeEach, describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import type { Job, PublishJob } from '../jobs/render-job';
import { createPublishQueueScheduler } from './publish-queue-scheduler';
import type { PublishQueueTimer } from './publish-queue-scheduler';
import {
  CATEGORY_PLAYLISTS_SETTINGS_KEY,
  GENERAL_PLAYLIST_SETTINGS_KEY,
  PUBLISH_QUEUE_SETTINGS_KEY,
  readPublishQueueSettings,
} from './publish-queue-settings';

const START = Date.parse('2026-10-13T10:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

interface Harness {
  readonly deps: RenderApiDependencies;
  readonly scheduler: ReturnType<typeof createPublishQueueScheduler>;
  readonly launched: { itemId: string; playlistIds: readonly string[] }[];
  readonly jobs: Map<string, Job>;
  readonly timer: { everyCallbacks: (() => void)[]; afterCallbacks: (() => void)[]; stopped: number };
  advance(ms: number): void;
  finishJob(jobId: string, outcome: { error: RenderApiErrorPayload } | { url: string }): void;
  enqueue(slug: string, file: string, overrides?: Record<string, unknown>): string;
  statusOf(id: string): string | undefined;
}

function publishJob(id: string, state: PublishJob['state'], extra: Partial<PublishJob> = {}): PublishJob {
  return {
    id,
    slug: 'promo',
    kind: 'publish',
    state,
    createdAt: 'x',
    startedAt: null,
    finishedAt: null,
    error: null,
    progress: null,
    report: null,
    ...extra,
  };
}

function build(): Harness {
  let nowMs = START;
  const deps = createFakeRenderApiDependencies(createCallLog(), { clock: { nowIso: () => new Date(nowMs).toISOString() } });
  deps.localStore.projects.insert('promo');
  deps.localStore.projects.insert('other');
  const launched: Harness['launched'] = [];
  const jobs = new Map<string, Job>();
  const timer = { everyCallbacks: [] as (() => void)[], afterCallbacks: [] as (() => void)[], stopped: 0 };
  const fakeTimer: PublishQueueTimer = {
    every: (_ms, callback) => {
      timer.everyCallbacks.push(callback);
      return () => {
        timer.stopped += 1;
      };
    },
    after: (_ms, callback) => {
      timer.afterCallbacks.push(callback);
      return () => {
        timer.stopped += 1;
      };
    },
  };
  const scheduler = createPublishQueueScheduler({
    localStore: deps.localStore,
    clock: deps.clock,
    timer: fakeTimer,
    jobs: { get: (id) => jobs.get(id) ?? null },
    launchPublishJob: async (item, playlistIds) => {
      launched.push({ itemId: item.id, playlistIds });
      const job = publishJob(`job-${String(launched.length)}`, 'running');
      jobs.set(job.id, job);
      deps.localStore.jobs.insert({
        id: job.id,
        slug: item.slug,
        kind: 'publish',
        state: 'running',
        params: {},
        createdAt: deps.clock.nowIso(),
      });
      return job;
    },
  });
  let counter = 0;
  return {
    deps,
    scheduler,
    launched,
    jobs,
    timer,
    advance: (ms) => {
      nowMs += ms;
    },
    finishJob: (jobId, outcome) => {
      const state = 'error' in outcome ? 'failed' : 'succeeded';
      jobs.set(
        jobId,
        publishJob(jobId, state, {
          error: 'error' in outcome ? outcome.error : null,
          report:
            'url' in outcome
              ? { videoId: 'v', url: outcome.url, privacy: 'public', publishAt: null, title: 't' }
              : null,
        }),
      );
      deps.localStore.jobs.updateState(jobId, state, undefined, deps.clock.nowIso(), null);
    },
    enqueue: (slug, file, overrides = {}) => {
      counter += 1;
      const id = `item-${String(counter)}`;
      deps.localStore.publishQueue.insert({
        id,
        slug,
        file,
        metadata: { title: id, description: '', tags: [], privacy: 'public', ...overrides },
        createdAt: deps.clock.nowIso(),
      });
      return id;
    },
    statusOf: (id) => deps.localStore.publishQueue.get(id)?.status,
  };
}

function resume(h: Harness): void {
  h.deps.localStore.settings.set(PUBLISH_QUEUE_SETTINGS_KEY, { paused: false, dailyLimit: 10 });
}

function quotaError(): RenderApiErrorPayload {
  return { code: 'YOUTUBE_QUOTA_EXCEEDED', stage: 'upload', message: 'quota' };
}

describe('createPublishQueueScheduler', () => {
  let h: Harness;

  beforeEach(() => {
    h = build();
  });

  it('is born paused and publishes nothing', async () => {
    h.enqueue('promo', 'out/a.mp4');

    await h.scheduler.poke();

    expect(readPublishQueueSettings(h.deps.localStore.settings)).toEqual({ paused: true, dailyLimit: 10 });
    expect(h.launched).toEqual([]);
  });

  it('launches the first queued item in order and one at a time', async () => {
    resume(h);
    const first = h.enqueue('promo', 'out/a.mp4');
    const second = h.enqueue('promo', 'out/b.mp4');

    await h.scheduler.poke();
    await h.scheduler.poke();

    expect(h.launched.map((entry) => entry.itemId)).toEqual([first]);
    expect(h.statusOf(first)).toBe('publishing');
    expect(h.statusOf(second)).toBe('queued');
  });

  it('does not start while a publish job from elsewhere is unfinished', async () => {
    resume(h);
    h.enqueue('promo', 'out/a.mp4');
    h.deps.localStore.jobs.insert({
      id: 'manual',
      slug: 'promo',
      kind: 'publish',
      state: 'running',
      params: {},
      createdAt: h.deps.clock.nowIso(),
    });

    await h.scheduler.poke();

    expect(h.launched).toEqual([]);
  });

  it('marks the item published with its url and moves on to the next', async () => {
    resume(h);
    const first = h.enqueue('promo', 'out/a.mp4');
    const second = h.enqueue('promo', 'out/b.mp4');
    await h.scheduler.poke();

    h.finishJob('job-1', { url: 'https://youtu.be/v1' });
    await h.scheduler.poke();

    expect(h.deps.localStore.publishQueue.get(first)).toMatchObject({ status: 'published', url: 'https://youtu.be/v1' });
    expect(h.statusOf(second)).toBe('publishing');
  });

  it('stops at the daily limit counting published and scheduled publications of the last 24 hours', async () => {
    h.deps.localStore.settings.set(PUBLISH_QUEUE_SETTINGS_KEY, { paused: false, dailyLimit: 2 });
    const insertPublication = (id: string, status: 'published' | 'scheduled' | 'failed', createdAt: string) => {
      h.deps.localStore.publications.insert({
        id,
        slug: 'other',
        platform: 'youtube',
        file: `out/${id}.mp4`,
        title: id,
        privacy: 'public',
        status,
        publishAt: null,
        jobId: null,
        createdAt,
      });
    };
    insertPublication('p1', 'published', new Date(START - HOUR_MS).toISOString());
    insertPublication('p2', 'scheduled', new Date(START - 2 * HOUR_MS).toISOString());
    insertPublication('p3', 'failed', new Date(START - HOUR_MS).toISOString());
    insertPublication('p4', 'published', new Date(START - 30 * HOUR_MS).toISOString());
    const item = h.enqueue('promo', 'out/a.mp4');

    await h.scheduler.poke();
    expect(h.launched).toEqual([]);

    h.advance(23 * HOUR_MS);
    await h.scheduler.poke();
    expect(h.launched.map((entry) => entry.itemId)).toEqual([item]);
  });

  it('sends a quota error back to the queue one hour later and holds the rest of the queue', async () => {
    resume(h);
    const first = h.enqueue('promo', 'out/a.mp4');
    const second = h.enqueue('promo', 'out/b.mp4');
    await h.scheduler.poke();

    h.finishJob('job-1', { error: quotaError() });
    await h.scheduler.poke();

    const retryAt = new Date(START + HOUR_MS).toISOString();
    expect(h.deps.localStore.publishQueue.get(first)).toMatchObject({
      status: 'queued',
      attempts: 1,
      nextAttemptAt: retryAt,
      lastError: { code: 'YOUTUBE_QUOTA_EXCEEDED' },
    });
    expect(h.deps.localStore.publishQueue.get(second)?.nextAttemptAt).toBe(retryAt);
    expect(h.launched).toHaveLength(1);

    h.advance(HOUR_MS);
    await h.scheduler.poke();
    expect(h.launched.map((entry) => entry.itemId)).toEqual([first, first]);
  });

  it('pauses the queue when YouTube is not connected and keeps the item queued', async () => {
    resume(h);
    const first = h.enqueue('promo', 'out/a.mp4');
    await h.scheduler.poke();

    h.finishJob('job-1', { error: { code: 'YOUTUBE_NOT_CONNECTED', stage: null, message: 'revoked' } });
    await h.scheduler.poke();

    expect(h.statusOf(first)).toBe('queued');
    expect(readPublishQueueSettings(h.deps.localStore.settings).paused).toBe(true);
  });

  it('marks any other error as failed and continues with the next item', async () => {
    resume(h);
    const first = h.enqueue('promo', 'out/a.mp4');
    const second = h.enqueue('promo', 'out/b.mp4');
    await h.scheduler.poke();

    h.finishJob('job-1', { error: { code: 'YOUTUBE_UPLOAD_FAILED', stage: 'upload', message: 'boom' } });
    await h.scheduler.poke();

    expect(h.deps.localStore.publishQueue.get(first)).toMatchObject({
      status: 'failed',
      lastError: { code: 'YOUTUBE_UPLOAD_FAILED' },
    });
    expect(h.statusOf(second)).toBe('publishing');
  });

  it('marks an item already-published with the existing url instead of uploading it again', async () => {
    resume(h);
    h.deps.localStore.publications.insert({
      id: 'pub',
      slug: 'promo',
      platform: 'youtube',
      file: 'out/a.mp4',
      title: 'a',
      privacy: 'public',
      status: 'scheduled',
      publishAt: null,
      jobId: null,
      createdAt: new Date(START - 40 * HOUR_MS).toISOString(),
    });
    h.deps.localStore.publications.update('pub', { status: 'scheduled', url: 'https://youtu.be/old' });
    const duplicate = h.enqueue('promo', 'out/a.mp4');
    const fresh = h.enqueue('promo', 'out/b.mp4');

    await h.scheduler.poke();

    expect(h.deps.localStore.publishQueue.get(duplicate)).toMatchObject({
      status: 'already-published',
      url: 'https://youtu.be/old',
    });
    expect(h.statusOf(fresh)).toBe('publishing');
    expect(h.launched.map((entry) => entry.itemId)).toEqual([fresh]);
  });

  it('uses its own playlists, else the category playlist plus the general one', async () => {
    resume(h);
    const { organization, settings } = h.deps.localStore;
    organization.createFolder('tutoriales', 'Tutoriales');
    organization.createCategory('basicos', 'tutoriales', 'Basicos');
    organization.setPlacement('promo', { folderId: 'tutoriales', categoryId: 'basicos', archived: false });
    settings.set(CATEGORY_PLAYLISTS_SETTINGS_KEY, { basicos: 'PL_CAT' });
    settings.set(GENERAL_PLAYLIST_SETTINGS_KEY, 'PL_ALL');
    h.enqueue('promo', 'out/own.mp4', { playlistIds: ['PL_OWN'] });
    h.enqueue('promo', 'out/default.mp4');
    h.enqueue('other', 'out/unplaced.mp4');

    for (const jobId of ['job-1', 'job-2', 'job-3']) {
      await h.scheduler.poke();
      h.finishJob(jobId, { url: `https://youtu.be/${jobId}` });
    }
    await h.scheduler.poke();

    expect(h.launched.map((entry) => entry.playlistIds)).toEqual([['PL_OWN'], ['PL_CAT', 'PL_ALL'], ['PL_ALL']]);
  });

  it('requeues publishing items whose job is gone when it starts', async () => {
    const item = h.enqueue('promo', 'out/a.mp4');
    h.deps.localStore.publishQueue.update(item, { status: 'publishing', jobId: 'ghost', updatedAt: 'x' });

    h.scheduler.start();
    await h.scheduler.poke();

    expect(h.statusOf(item)).toBe('queued');
    expect(h.deps.localStore.publishQueue.get(item)?.jobId).toBeNull();
  });

  it('ticks from the injected timer and stops it', async () => {
    resume(h);
    h.scheduler.start();
    h.enqueue('promo', 'out/a.mp4');

    h.timer.everyCallbacks[0]?.();
    await h.scheduler.poke();
    expect(h.launched).toHaveLength(1);

    h.scheduler.stop();
    expect(h.timer.stopped).toBeGreaterThanOrEqual(1);
  });

  it('keeps unrelated settings keys intact', () => {
    h.deps.localStore.settings.set(CATEGORY_PLAYLISTS_SETTINGS_KEY, { x: 'PL' });
    h.deps.localStore.settings.set(GENERAL_PLAYLIST_SETTINGS_KEY, 'PLG');
    expect(h.deps.localStore.settings.get(GENERAL_PLAYLIST_SETTINGS_KEY)).toBe('PLG');
  });
});
