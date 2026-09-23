import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createSettingsRepository } from './settings-repository';

describe('createSettingsRepository', () => {
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

  it('returns null for a key that was never set', () => {
    const repository = createSettingsRepository(db);
    expect(repository.get('render.engine')).toBeNull();
  });

  it('round-trips JSON values, including nested objects and arrays', () => {
    const repository = createSettingsRepository(db, () => '2026-01-01T00:00:00.000Z');
    repository.set('render.engine', { name: 'remotion', flags: ['gpu', 'hq'] });

    expect(repository.get('render.engine')).toEqual({ name: 'remotion', flags: ['gpu', 'hq'] });
  });

  it('overwrites an existing key and refreshes updatedAt', () => {
    let now = '2026-01-01T00:00:00.000Z';
    const repository = createSettingsRepository(db, () => now);
    repository.set('trial', { active: true });

    now = '2026-02-02T00:00:00.000Z';
    repository.set('trial', { active: false });

    expect(repository.get('trial')).toEqual({ active: false });
    const row = db.select().from(schema.settings).all()[0];
    expect(row?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('deletes a key', () => {
    const repository = createSettingsRepository(db);
    repository.set('to-remove', 'value');
    repository.delete('to-remove');

    expect(repository.get('to-remove')).toBeNull();
  });
});
