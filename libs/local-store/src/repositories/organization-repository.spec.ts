import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createOrganizationRepository, EMPTY_ORGANIZATION } from './organization-repository';
import { createProjectsRepository } from './projects-repository';

describe('createOrganizationRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    createProjectsRepository(db, () => 'now').insert('video-a');
    createProjectsRepository(db, () => 'now').insert('video-b');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('returns the empty organization for a fresh database', () => {
    const repository = createOrganizationRepository(db);
    expect(repository.getOrganization()).toEqual(EMPTY_ORGANIZATION);
  });

  it('creates folders and categories keeping insertion order as position', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.createFolder('archive', 'Archive');
    repository.createCategory('cat-a', 'clients', 'Category A');
    repository.createCategory('cat-b', 'clients', 'Category B');

    const organization = repository.getOrganization();
    expect(organization.folders.map((folder) => folder.id)).toEqual(['clients', 'archive']);
    expect(organization.folders[0]?.categories.map((category) => category.id)).toEqual(['cat-a', 'cat-b']);
  });

  it('renames a folder', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.renameFolder('clients', 'Customers');

    expect(repository.getOrganization().folders[0]?.name).toBe('Customers');
  });

  it('sets and reads a placement', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.createCategory('cat-a', 'clients', 'Category A');
    repository.setPlacement('video-a', { folderId: 'clients', categoryId: 'cat-a', archived: false });

    expect(repository.getOrganization().videos['video-a']).toEqual({
      folderId: 'clients',
      categoryId: 'cat-a',
      archived: false,
    });
  });

  it('does not persist a default placement, keeping the videos map sparse', () => {
    const repository = createOrganizationRepository(db);
    repository.setPlacement('video-a', { folderId: null, categoryId: null, archived: false });

    expect(repository.getOrganization().videos).toEqual({});
  });

  it('removes a placement once it returns to the default shape', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.setPlacement('video-a', { folderId: 'clients', categoryId: null, archived: false });
    repository.setPlacement('video-a', { folderId: null, categoryId: null, archived: false });

    expect(repository.getOrganization().videos).toEqual({});
  });

  it('deleting a folder cascades: its categories disappear and placements are nulled by the FK', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.createCategory('cat-a', 'clients', 'Category A');
    repository.setPlacement('video-a', { folderId: 'clients', categoryId: 'cat-a', archived: true });

    repository.deleteFolder('clients');

    const organization = repository.getOrganization();
    expect(organization.folders).toHaveLength(0);
    expect(organization.videos['video-a']).toEqual({ folderId: null, categoryId: null, archived: true });
  });

  it('deleting a category nulls its placements via the FK, keeping the folder placement', () => {
    const repository = createOrganizationRepository(db);
    repository.createFolder('clients', 'Clients');
    repository.createCategory('cat-a', 'clients', 'Category A');
    repository.setPlacement('video-a', { folderId: 'clients', categoryId: 'cat-a', archived: false });

    repository.deleteCategory('cat-a');

    const organization = repository.getOrganization();
    expect(organization.videos['video-a']).toEqual({ folderId: 'clients', categoryId: null, archived: false });
  });
});
