import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { applyMigrations } from './migrations';
import * as schema from '../schema/studio-schema';

export const IN_MEMORY_DATABASE_PATH = ':memory:';

export interface StudioDatabase {
  readonly db: BetterSQLite3Database<typeof schema>;
  readonly sqlite: Database.Database;
  readonly close: () => void;
}

export function openStudioDatabase(path: string): StudioDatabase {
  const isInMemory = path === IN_MEMORY_DATABASE_PATH;

  if (!isInMemory) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const sqlite = new Database(path);

  if (!isInMemory) {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  applyMigrations(sqlite);

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => {
      sqlite.close();
    },
  };
}
