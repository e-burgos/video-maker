import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { currentUserVersion, MIGRATIONS } from './migrations';
import { openStudioDatabase } from './open-studio-database';

describe('openStudioDatabase', () => {
  const directories: string[] = [];

  afterEach(() => {
    while (directories.length > 0) {
      const directory = directories.pop();
      if (directory !== undefined) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  function makeTempDbPath(): string {
    const directory = mkdtempSync(join(tmpdir(), 'local-store-'));
    directories.push(directory);
    return join(directory, 'nested', 'studio.db');
  }

  it('runs a SELECT 1 against an in-memory database', () => {
    const database = openStudioDatabase(':memory:');
    const row = database.sqlite.prepare('SELECT 1 as one').get() as { one: number };
    expect(row.one).toBe(1);
    database.close();
  });

  it('applies migrations up to the latest user_version', () => {
    const database = openStudioDatabase(':memory:');
    expect(currentUserVersion(database.sqlite)).toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
    database.close();
  });

  it('creates the parent directory for a file path and leaves the file usable', () => {
    const path = makeTempDbPath();
    const database = openStudioDatabase(path);
    expect(existsSync(path)).toBe(true);
    database.close();
  });

  it('enables WAL mode for file-backed databases', () => {
    const path = makeTempDbPath();
    const database = openStudioDatabase(path);
    const mode = database.sqlite.pragma('journal_mode', { simple: true }) as string;
    expect(mode).toBe('wal');
    database.close();
  });

  it('does not force WAL mode for :memory: databases', () => {
    const database = openStudioDatabase(':memory:');
    const mode = database.sqlite.pragma('journal_mode', { simple: true }) as string;
    expect(mode).not.toBe('wal');
    database.close();
  });

  it('enables foreign key enforcement', () => {
    const database = openStudioDatabase(':memory:');
    const enabled = database.sqlite.pragma('foreign_keys', { simple: true }) as number;
    expect(enabled).toBe(1);
    database.close();
  });

  it('sets a busy_timeout of 5000ms', () => {
    const database = openStudioDatabase(':memory:');
    const timeout = database.sqlite.pragma('busy_timeout', { simple: true }) as number;
    expect(timeout).toBe(5000);
    database.close();
  });

  it('does not reapply migrations when the same file is opened twice', () => {
    const path = makeTempDbPath();
    const first = openStudioDatabase(path);
    first.close();

    const second = openStudioDatabase(path);
    expect(currentUserVersion(second.sqlite)).toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
    second.close();
  });
});
