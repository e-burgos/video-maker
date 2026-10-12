import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createJobsRepository } from './jobs-repository';
import { createProjectsRepository } from './projects-repository';

describe('createJobsRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    createProjectsRepository(db, () => 'now').insert('video-a');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('inserts a job with JSON params and null progress/report/error', () => {
    const repository = createJobsRepository(db);
    const record = repository.insert({
      id: 'job-1',
      slug: 'video-a',
      kind: 'render',
      state: 'queued',
      params: { timeline: { scenes: [] } },
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(record).toEqual({
      id: 'job-1',
      slug: 'video-a',
      kind: 'render',
      state: 'queued',
      params: { timeline: { scenes: [] } },
      progress: null,
      report: null,
      error: null,
      retryOf: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    expect(repository.get('job-1')).toEqual(record);
  });

  it('accepts a retryOf reference', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'failed', params: {}, createdAt: 'a' });
    const retry = repository.insert({
      id: 'job-2',
      slug: 'video-a',
      kind: 'render',
      state: 'queued',
      params: {},
      createdAt: 'b',
      retryOf: 'job-1',
    });

    expect(retry.retryOf).toBe('job-1');
  });

  it('updates state, timestamps and error independently', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'a' });

    repository.updateState('job-1', 'running', '2026-01-01T00:01:00.000Z');
    expect(repository.get('job-1')).toMatchObject({ state: 'running', startedAt: '2026-01-01T00:01:00.000Z' });

    repository.updateState('job-1', 'failed', undefined, '2026-01-01T00:02:00.000Z', { code: 'BOOM' });
    expect(repository.get('job-1')).toMatchObject({
      state: 'failed',
      startedAt: '2026-01-01T00:01:00.000Z',
      finishedAt: '2026-01-01T00:02:00.000Z',
      error: { code: 'BOOM' },
    });

    repository.updateState('job-1', 'queued', undefined, undefined, null);
    expect(repository.get('job-1')?.error).toBeNull();
  });

  it('updates progress and report as JSON round-trips', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'running', params: {}, createdAt: 'a' });

    repository.updateProgress('job-1', { stage: 'render', percent: 42 });
    expect(repository.get('job-1')?.progress).toEqual({ stage: 'render', percent: 42 });

    repository.setReport('job-1', { path: '/out.mp4' });
    expect(repository.get('job-1')?.report).toEqual({ path: '/out.mp4' });

    repository.updateProgress('job-1', null);
    expect(repository.get('job-1')?.progress).toBeNull();

    repository.setReport('job-1', null);
    expect(repository.get('job-1')?.report).toBeNull();
  });

  it('returns null for an unknown job id', () => {
    const repository = createJobsRepository(db);
    expect(repository.get('missing')).toBeNull();
  });

  it('lists jobs by project newest first', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'a' });
    repository.insert({ id: 'job-2', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'b' });
    repository.insert({ id: 'job-3', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'c' });

    expect(repository.listByProject('video-a').map((job) => job.id)).toEqual(['job-3', 'job-2', 'job-1']);
  });

  it('lists only queued, running or canceling jobs as unfinished', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'a' });
    repository.insert({ id: 'job-2', slug: 'video-a', kind: 'render', state: 'running', params: {}, createdAt: 'b' });
    repository.insert({ id: 'job-3', slug: 'video-a', kind: 'render', state: 'canceling', params: {}, createdAt: 'c' });
    repository.insert({ id: 'job-4', slug: 'video-a', kind: 'render', state: 'succeeded', params: {}, createdAt: 'd' });

    expect(repository.listUnfinished().map((job) => job.id).sort()).toEqual(['job-1', 'job-2', 'job-3']);
  });

  it('marks a batch of jobs as interrupted in one transaction', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'a' });
    repository.insert({ id: 'job-2', slug: 'video-a', kind: 'render', state: 'running', params: {}, createdAt: 'b' });

    repository.markInterrupted(['job-1', 'job-2'], { code: 'JOB_INTERRUPTED' }, '2026-01-01T00:00:00.000Z');

    for (const id of ['job-1', 'job-2']) {
      const job = repository.get(id);
      expect(job?.state).toBe('failed');
      expect(job?.error).toEqual({ code: 'JOB_INTERRUPTED' });
      expect(job?.finishedAt).toBe('2026-01-01T00:00:00.000Z');
    }
  });

  it('lists only succeeded jobs of the requested kinds, newest finish first, up to the limit', () => {
    const repository = createJobsRepository(db);
    const succeeded = (id: string, kind: string, finishedAt: string): void => {
      repository.insert({ id, slug: 'video-a', kind, state: 'queued', params: {}, createdAt: id });
      repository.updateState(id, 'succeeded', undefined, finishedAt);
    };
    succeeded('job-1', 'render', '2026-01-01T00:00:01.000Z');
    succeeded('job-2', 'motion', '2026-01-01T00:00:03.000Z');
    succeeded('job-3', 'render', '2026-01-01T00:00:02.000Z');
    succeeded('job-4', 'voice', '2026-01-01T00:00:04.000Z');
    repository.insert({ id: 'job-5', slug: 'video-a', kind: 'render', state: 'failed', params: {}, createdAt: 'e' });

    expect(repository.listSucceededByKinds(['render', 'motion'], 10).map((job) => job.id)).toEqual(['job-2', 'job-3', 'job-1']);
    expect(repository.listSucceededByKinds(['render', 'motion'], 2).map((job) => job.id)).toEqual(['job-2', 'job-3']);
  });

  it('cascades job deletion when its project is removed', () => {
    const repository = createJobsRepository(db);
    repository.insert({ id: 'job-1', slug: 'video-a', kind: 'render', state: 'queued', params: {}, createdAt: 'a' });

    createProjectsRepository(db).delete('video-a');

    expect(repository.get('job-1')).toBeNull();
  });
});
