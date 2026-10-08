import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createProjectsRepository } from './projects-repository';
import { createPublicationsRepository } from './publications-repository';
import type { NewPublicationRecord } from './publications-repository';

function newPublication(overrides: Partial<NewPublicationRecord> = {}): NewPublicationRecord {
  return {
    id: 'pub-1',
    slug: 'demo',
    platform: 'youtube',
    file: 'out/video.mp4',
    title: 'Demo',
    privacy: 'public',
    status: 'uploading',
    publishAt: null,
    jobId: 'job-1',
    createdAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('createPublicationsRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    const projects = createProjectsRepository(db);
    projects.insert('demo');
    projects.insert('other');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('inserts an uploading publication without video id, url or published date', () => {
    const repository = createPublicationsRepository(db);

    const record = repository.insert(newPublication());

    expect(Object.keys(record).sort()).toEqual([
      'createdAt',
      'file',
      'id',
      'jobId',
      'platform',
      'privacy',
      'publishAt',
      'publishedAt',
      'slug',
      'status',
      'title',
      'url',
      'videoId',
    ]);
    expect(repository.get('pub-1')).toEqual(record);
  });

  it('updates a publication to published with its video id and url', () => {
    const repository = createPublicationsRepository(db);
    repository.insert(newPublication());

    repository.update('pub-1', {
      status: 'published',
      videoId: 'abc123',
      url: 'https://youtu.be/abc123',
      publishedAt: '2026-10-08T10:05:00.000Z',
    });

    expect(repository.get('pub-1')).toMatchObject({
      status: 'published',
      videoId: 'abc123',
      url: 'https://youtu.be/abc123',
      publishedAt: '2026-10-08T10:05:00.000Z',
    });
  });

  it('lists a project publications newest first', () => {
    const repository = createPublicationsRepository(db);
    repository.insert(newPublication({ id: 'pub-1', createdAt: '2026-10-08T10:00:00.000Z' }));
    repository.insert(newPublication({ id: 'pub-2', createdAt: '2026-10-08T11:00:00.000Z' }));
    repository.insert(newPublication({ id: 'pub-3', slug: 'other', createdAt: '2026-10-08T12:00:00.000Z' }));

    expect(repository.listByProject('demo').map((record) => record.id)).toEqual(['pub-2', 'pub-1']);
  });

  it('returns the newest publication of each project', () => {
    const repository = createPublicationsRepository(db);
    repository.insert(newPublication({ id: 'pub-1', createdAt: '2026-10-08T10:00:00.000Z' }));
    repository.insert(newPublication({ id: 'pub-2', createdAt: '2026-10-08T11:00:00.000Z' }));
    repository.insert(newPublication({ id: 'pub-3', slug: 'other', createdAt: '2026-10-08T12:00:00.000Z' }));

    const latest = repository.latestByProject();

    expect(latest.get('demo')?.id).toBe('pub-2');
    expect(latest.get('other')?.id).toBe('pub-3');
  });

  it('fails the uploading publications of interrupted jobs and leaves the rest alone', () => {
    const repository = createPublicationsRepository(db);
    repository.insert(newPublication({ id: 'pub-1', jobId: 'job-1' }));
    repository.insert(newPublication({ id: 'pub-2', jobId: 'job-2' }));
    repository.insert(newPublication({ id: 'pub-3', jobId: 'job-1', status: 'published' }));

    repository.failUploadingForJobs(['job-1']);

    expect(repository.get('pub-1')?.status).toBe('failed');
    expect(repository.get('pub-2')?.status).toBe('uploading');
    expect(repository.get('pub-3')?.status).toBe('published');
  });

  it('deletes the publications of a deleted project', () => {
    const repository = createPublicationsRepository(db);
    repository.insert(newPublication());

    createProjectsRepository(db).delete('demo');

    expect(repository.listByProject('demo')).toEqual([]);
  });
});
