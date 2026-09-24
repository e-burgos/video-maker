import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import { applyMigrations, currentUserVersion, MIGRATIONS } from './migrations';
import * as schema from '../schema/studio-schema';

interface SqliteColumnInfo {
  readonly name: string;
  readonly notnull: number;
  readonly pk: number;
}

interface SqliteForeignKeyInfo {
  readonly table: string;
  readonly from: string;
  readonly to: string;
  readonly on_delete: string;
}

interface SqliteIndexInfo {
  readonly name: string;
  readonly unique: number;
}

function openMigratedMemoryDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return sqlite;
}

describe('applyMigrations', () => {
  it('leaves user_version at 0 on a fresh database', () => {
    const sqlite = new Database(':memory:');
    expect(currentUserVersion(sqlite)).toBe(0);
    sqlite.close();
  });

  it('applies every migration once and sets user_version to the latest', () => {
    const sqlite = openMigratedMemoryDatabase();
    expect(currentUserVersion(sqlite)).toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
    sqlite.close();
  });

  it('does not reapply migrations when opened twice', () => {
    const sqlite = openMigratedMemoryDatabase();
    const before = sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").all() as [
      { count: number },
    ];
    applyMigrations(sqlite);
    const after = sqlite.prepare("select count(*) as count from sqlite_master where type = 'table'").all() as [
      { count: number },
    ];
    expect(after[0]?.count).toBe(before[0]?.count);
    sqlite.close();
  });

  it('rolls back a failing migration and leaves user_version unchanged', () => {
    const sqlite = new Database(':memory:');
    const brokenMigrations = [{ version: 1, statements: ['CREATE TABLE projects (slug TEXT PRIMARY KEY)', 'NOT VALID SQL'] }];

    expect(() => applyMigrations(sqlite, brokenMigrations)).toThrow();
    expect(currentUserVersion(sqlite)).toBe(0);
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.some((table) => table.name === 'projects')).toBe(false);
    sqlite.close();
  });

  it('only applies pending migrations above the current user_version', () => {
    const sqlite = new Database(':memory:');
    const first = { version: 1, statements: ['CREATE TABLE a (id TEXT PRIMARY KEY)'] };
    const second = { version: 2, statements: ['CREATE TABLE b (id TEXT PRIMARY KEY)'] };

    applyMigrations(sqlite, [first]);
    expect(currentUserVersion(sqlite)).toBe(1);

    applyMigrations(sqlite, [first, second]);
    expect(currentUserVersion(sqlite)).toBe(2);

    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name).sort()).toEqual(['a', 'b']);
    sqlite.close();
  });

  it('applies several pending migrations in version order regardless of input order', () => {
    const sqlite = new Database(':memory:');
    const first = { version: 1, statements: ['CREATE TABLE a (id TEXT PRIMARY KEY)'] };
    const second = { version: 2, statements: ['CREATE TABLE b (id TEXT PRIMARY KEY REFERENCES a(id))'] };

    applyMigrations(sqlite, [second, first]);

    expect(currentUserVersion(sqlite)).toBe(2);
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name).sort()).toEqual(['a', 'b']);
    sqlite.close();
  });

  it('migrates from v1 to v2 without losing existing producer_messages rows, adding a nullable usage column', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite, [MIGRATIONS[0] as (typeof MIGRATIONS)[number]]);
    expect(currentUserVersion(sqlite)).toBe(1);

    sqlite.exec(`INSERT INTO projects (slug, created_at, updated_at) VALUES ('demo-01', 't', 't')`);
    sqlite.exec(
      `INSERT INTO producer_messages (id, slug, seq, role, text, created_at) VALUES ('msg-1', 'demo-01', 1, 'user', 'hola', 't')`,
    );

    applyMigrations(sqlite, MIGRATIONS);
    expect(currentUserVersion(sqlite)).toBe(2);

    const columns = sqlite.pragma('table_info(producer_messages)') as SqliteColumnInfo[];
    expect(columns.some((column) => column.name === 'usage')).toBe(true);

    const row = sqlite.prepare('select id, usage from producer_messages where id = ?').get('msg-1') as {
      id: string;
      usage: string | null;
    };
    expect(row).toEqual({ id: 'msg-1', usage: null });

    sqlite.exec(
      `INSERT INTO producer_messages (id, slug, seq, role, text, created_at, usage) VALUES ('msg-2', 'demo-01', 2, 'assistant', 'listo', 't', '{"inputTokens":10,"outputTokens":5,"costUsd":0.001}')`,
    );
    const withUsage = sqlite.prepare('select usage from producer_messages where id = ?').get('msg-2') as {
      usage: string | null;
    };
    expect(withUsage.usage).toBe('{"inputTokens":10,"outputTokens":5,"costUsd":0.001}');

    sqlite.close();
  });

  it('migrates a fresh :memory: database that matches the Drizzle schema exactly', () => {
    const sqlite = openMigratedMemoryDatabase();

    const tables = Object.values(schema) as SQLiteTable[];
    expect(tables.length).toBeGreaterThan(0);

    for (const table of tables) {
      const config = getTableConfig(table);
      const columnInfo = sqlite.pragma(`table_info(${config.name})`) as SqliteColumnInfo[];

      const actualColumnNames = columnInfo.map((column) => column.name).sort();
      const expectedColumnNames = config.columns.map((column) => column.name).sort();
      expect(actualColumnNames).toEqual(expectedColumnNames);

      for (const column of config.columns) {
        const info = columnInfo.find((candidate) => candidate.name === column.name);
        expect(info, `${config.name}.${column.name} missing from table_info`).toBeDefined();
        const expectedNotNull = Boolean(column.notNull) && !column.primary;
        expect(Boolean(info?.notnull)).toBe(expectedNotNull);
        expect(Boolean(info?.pk)).toBe(column.primary);
      }

      const foreignKeyInfo = sqlite.pragma(`foreign_key_list(${config.name})`) as SqliteForeignKeyInfo[];
      expect(foreignKeyInfo).toHaveLength(config.foreignKeys.length);

      for (const foreignKey of config.foreignKeys) {
        const reference = foreignKey.reference();
        const fromColumn = reference.columns[0]?.name;
        const toColumn = reference.foreignColumns[0]?.name;
        const toTable = getTableConfig(reference.foreignTable).name;

        const match = foreignKeyInfo.find(
          (candidate) => candidate.from === fromColumn && candidate.table === toTable && candidate.to === toColumn,
        );
        expect(match, `${config.name}.${String(fromColumn)} -> ${toTable}.${String(toColumn)} missing`).toBeDefined();
        expect(match?.on_delete.toLowerCase()).toBe(foreignKey.onDelete);
      }

      const indexInfo = sqlite.pragma(`index_list(${config.name})`) as SqliteIndexInfo[];
      const namedIndexes = indexInfo.filter((index) => !index.name.startsWith('sqlite_autoindex_'));
      expect(namedIndexes).toHaveLength(config.indexes.length);

      for (const index of config.indexes) {
        const match = namedIndexes.find((candidate) => candidate.name === index.config.name);
        expect(match, `index ${index.config.name} missing`).toBeDefined();
        expect(Boolean(match?.unique)).toBe(Boolean(index.config.unique));
      }
    }

    sqlite.close();
  });
});
