# local-store

The SQLite database of the studio: better-sqlite3 (synchronous, native) with a Drizzle schema.

- `openStudioDatabase(path | ':memory:')` — creates the parent directory, turns on WAL (files only),
  `foreign_keys` and `busy_timeout`, and applies pending migrations.
- `database/migrations.ts` — hand-written SQL, one transaction per migration, versioned by
  `PRAGMA user_version`. No `drizzle-kit` at runtime: a packaged app cannot generate migrations.
  A spec migrates a fresh database and asserts it matches `studioSchema`, so the two cannot drift.
- `repositories/` — projects, organization, producer (messages and session), jobs and settings.
  JSON columns come back as `unknown`: callers validate them with their own parsers.

Two constraints worth knowing:

- `better-sqlite3` is loaded with `createRequire`, not a default import: under `@swc-node/register`
  (how `render-api` runs in development) the default import of its CJS `export =` is not a constructor.
- Category ids are unique across the whole organization, not per folder.

Media never goes in the database: only state, metadata and paths relative to a project.
