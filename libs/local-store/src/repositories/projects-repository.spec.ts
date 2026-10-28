import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createProjectsRepository } from './projects-repository';

describe('createProjectsRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
  });

  afterEach(() => {
    sqlite.close();
  });

  it('inserts a project using the injected clock and reports it as existing', () => {
    const repository = createProjectsRepository(db, () => '2026-09-23T00:00:00.000Z');
    const record = repository.insert('my-video');

    expect(record).toEqual({
      slug: 'my-video',
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
      importedAt: null,
      mode: 'footage',
      brand: null,
      title: null,
    });
    expect(repository.exists('my-video')).toBe(true);
    expect(repository.exists('missing')).toBe(false);
  });

  it('accepts an importedAt timestamp', () => {
    const repository = createProjectsRepository(db, () => '2026-09-23T00:00:00.000Z');
    const record = repository.insert('imported-video', '2026-01-01T00:00:00.000Z');
    expect(record.importedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('inserts a motion project and returns its mode from get and list', () => {
    const repository = createProjectsRepository(db);
    repository.insert('footage-one');
    repository.insert('motion-one', null, 'motion');

    expect(repository.get('motion-one')?.mode).toBe('motion');
    expect(repository.get('footage-one')?.mode).toBe('footage');
    expect(repository.list().map((project) => [project.slug, project.mode])).toEqual([
      ['footage-one', 'footage'],
      ['motion-one', 'motion'],
    ]);
  });

  it('stores the display title with its accents on insert', () => {
    const repository = createProjectsRepository(db);
    repository.insert('cafe-aroma', null, 'motion', null, 'Café Aroma');
    expect(repository.get('cafe-aroma')?.title).toBe('Café Aroma');
    expect(repository.list().find((record) => record.slug === 'cafe-aroma')?.title).toBe('Café Aroma');
  });

  it('stores the brand on insert and changes it with setBrand', () => {
    const repository = createProjectsRepository(db);
    repository.insert('branded', null, 'motion', 'acme');
    expect(repository.get('branded')?.brand).toBe('acme');

    repository.setBrand('branded', 'other');
    expect(repository.get('branded')?.brand).toBe('other');

    repository.setBrand('branded', null);
    expect(repository.get('branded')?.brand).toBeNull();
  });

  it('lists projects ordered by slug', () => {
    const repository = createProjectsRepository(db);
    repository.insert('zebra');
    repository.insert('alpha');
    repository.insert('mango');

    expect(repository.list().map((project) => project.slug)).toEqual(['alpha', 'mango', 'zebra']);
  });

  it('gets a project by slug or returns null', () => {
    const repository = createProjectsRepository(db);
    repository.insert('known');

    expect(repository.get('known')?.slug).toBe('known');
    expect(repository.get('unknown')).toBeNull();
  });

  it('touches a project, refreshing updatedAt via the clock', () => {
    let now = '2026-01-01T00:00:00.000Z';
    const repository = createProjectsRepository(db, () => now);
    repository.insert('slug-a');

    now = '2026-02-02T00:00:00.000Z';
    repository.touch('slug-a');

    expect(repository.get('slug-a')?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('deletes a project and cascades its placements, producer state and jobs', () => {
    const repository = createProjectsRepository(db);
    repository.insert('to-delete');

    db.insert(schema.placements).values({ slug: 'to-delete', folderId: null, categoryId: null, archived: true }).run();
    db
      .insert(schema.producerSessions)
      .values({ slug: 'to-delete', sessionId: 's1', model: 'sonnet', startedAt: 'a', updatedAt: 'a' })
      .run();
    db
      .insert(schema.producerMessages)
      .values({ id: 'm1', slug: 'to-delete', seq: 1, role: 'user', text: 'hi', createdAt: 'a' })
      .run();
    db
      .insert(schema.jobs)
      .values({ id: 'j1', slug: 'to-delete', kind: 'render', state: 'queued', params: '{}', createdAt: 'a' })
      .run();

    repository.delete('to-delete');

    expect(repository.exists('to-delete')).toBe(false);
    expect(db.select().from(schema.placements).all()).toHaveLength(0);
    expect(db.select().from(schema.producerSessions).all()).toHaveLength(0);
    expect(db.select().from(schema.producerMessages).all()).toHaveLength(0);
    expect(db.select().from(schema.jobs).all()).toHaveLength(0);
  });
});
