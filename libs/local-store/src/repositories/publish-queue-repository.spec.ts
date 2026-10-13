import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createProjectsRepository } from './projects-repository';
import { createPublishQueueRepository } from './publish-queue-repository';
import type { NewPublishQueueRecord } from './publish-queue-repository';

function newItem(id: string, overrides: Partial<NewPublishQueueRecord> = {}): NewPublishQueueRecord {
  return {
    id,
    slug: 'demo',
    file: 'out/video.mp4',
    metadata: { title: `Video ${id}`, description: 'd', tags: ['a'], privacy: 'public' },
    createdAt: '2026-10-13T10:00:00.000Z',
    ...overrides,
  };
}

describe('createPublishQueueRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    createProjectsRepository(db).insert('demo');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('inserts at the end as queued and round-trips the metadata', () => {
    const repository = createPublishQueueRepository(db);

    const first = repository.insert(newItem('a'));
    const second = repository.insert(newItem('b'));

    expect(Object.keys(first).sort()).toEqual([
      'attempts',
      'createdAt',
      'file',
      'id',
      'jobId',
      'lastError',
      'metadata',
      'nextAttemptAt',
      'position',
      'slug',
      'status',
      'updatedAt',
      'url',
    ]);
    expect(second.position).toBe(1);
    expect(repository.get('a')).toEqual(first);
    expect(repository.list().map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('updates status, error and attempt fields', () => {
    const repository = createPublishQueueRepository(db);
    repository.insert(newItem('a'));

    repository.update('a', {
      status: 'queued',
      attempts: 2,
      lastError: { code: 'YOUTUBE_QUOTA_EXCEEDED' },
      nextAttemptAt: '2026-10-13T11:00:00.000Z',
      updatedAt: '2026-10-13T10:05:00.000Z',
    });

    expect(repository.get('a')).toMatchObject({
      attempts: 2,
      lastError: { code: 'YOUTUBE_QUOTA_EXCEEDED' },
      nextAttemptAt: '2026-10-13T11:00:00.000Z',
    });
  });

  it('moves an item and renumbers the queue', () => {
    const repository = createPublishQueueRepository(db);
    repository.insert(newItem('a'));
    repository.insert(newItem('b'));
    repository.insert(newItem('c'));

    repository.move('c', 0);

    expect(repository.list().map((item) => [item.id, item.position])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('removes an item', () => {
    const repository = createPublishQueueRepository(db);
    repository.insert(newItem('a'));

    repository.remove('a');

    expect(repository.list()).toEqual([]);
  });

  it('returns the first queued item that is due', () => {
    const repository = createPublishQueueRepository(db);
    repository.insert(newItem('a'));
    repository.insert(newItem('b'));
    repository.insert(newItem('c'));
    repository.update('a', { nextAttemptAt: '2026-10-13T12:00:00.000Z', updatedAt: 't' });
    repository.update('b', { status: 'failed', updatedAt: 't' });

    expect(repository.nextDue('2026-10-13T11:00:00.000Z')?.id).toBe('c');
    expect(repository.nextDue('2026-10-13T12:00:00.000Z')?.id).toBe('a');
    expect(repository.earliestNextAttemptAt()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('deletes the queue items of a deleted project', () => {
    const repository = createPublishQueueRepository(db);
    repository.insert(newItem('a'));

    createProjectsRepository(db).delete('demo');

    expect(repository.list()).toEqual([]);
  });
});
