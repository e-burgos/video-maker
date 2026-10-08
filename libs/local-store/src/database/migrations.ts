import type Database from 'better-sqlite3';

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE projects (
        slug TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        imported_at TEXT
      )`,
      `CREATE TABLE folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER NOT NULL
      )`,
      `CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL
      )`,
      `CREATE TABLE placements (
        slug TEXT PRIMARY KEY REFERENCES projects(slug) ON DELETE CASCADE,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        archived INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE producer_sessions (
        slug TEXT PRIMARY KEY REFERENCES projects(slug) ON DELETE CASCADE,
        session_id TEXT NOT NULL,
        model TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE producer_messages (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        suggestions TEXT,
        turn_id TEXT,
        model TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX producer_messages_slug_seq_unique ON producer_messages (slug, seq)`,
      `CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        state TEXT NOT NULL,
        params TEXT NOT NULL,
        progress TEXT,
        report TEXT,
        error TEXT,
        retry_of TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      )`,
      `CREATE INDEX jobs_slug_created_at_idx ON jobs (slug, created_at)`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [`ALTER TABLE producer_messages ADD COLUMN usage TEXT`],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
        path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        proposed_role TEXT NOT NULL,
        proposal_reason TEXT NOT NULL,
        confirmed_role TEXT,
        status TEXT NOT NULL,
        probe TEXT NOT NULL,
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      )`,
      `CREATE INDEX assets_slug_status_idx ON assets (slug, status)`,
    ],
  },
  {
    version: 4,
    statements: [`ALTER TABLE projects ADD COLUMN mode TEXT NOT NULL DEFAULT 'footage'`],
  },
  {
    version: 5,
    statements: [`ALTER TABLE projects ADD COLUMN brand TEXT`],
  },
  {
    version: 6,
    statements: [
      `CREATE TABLE publications (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        file TEXT NOT NULL,
        title TEXT NOT NULL,
        video_id TEXT,
        url TEXT,
        privacy TEXT NOT NULL,
        status TEXT NOT NULL,
        publish_at TEXT,
        published_at TEXT,
        job_id TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX publications_slug_created_at_idx ON publications (slug, created_at)`,
    ],
  },
];

export function currentUserVersion(sqlite: Database.Database): number {
  return sqlite.pragma('user_version', { simple: true }) as number;
}

export function applyMigrations(
  sqlite: Database.Database,
  migrations: readonly Migration[] = MIGRATIONS,
): void {
  const pending = migrations
    .filter((migration) => migration.version > currentUserVersion(sqlite))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const run = sqlite.transaction(() => {
      for (const statement of migration.statements) {
        sqlite.exec(statement);
      }
      sqlite.pragma(`user_version = ${String(migration.version)}`);
    });
    run();
  }
}
