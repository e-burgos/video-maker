import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { projects } from '../schema/studio-schema';
import type { ProjectMode } from '../schema/project-mode';
import type * as schema from '../schema/studio-schema';

export interface ProjectRecord {
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly importedAt: string | null;
  readonly mode: ProjectMode;
  readonly brand: string | null;
  readonly title: string | null;
}

export type ProjectsClock = () => string;

const defaultClock: ProjectsClock = () => new Date().toISOString();

export function createProjectsRepository(
  db: BetterSQLite3Database<typeof schema>,
  clock: ProjectsClock = defaultClock,
) {
  function list(): readonly ProjectRecord[] {
    return db.select().from(projects).orderBy(asc(projects.slug)).all();
  }

  function get(slug: string): ProjectRecord | null {
    const row = db.select().from(projects).where(eq(projects.slug, slug)).get();
    return row ?? null;
  }

  function exists(slug: string): boolean {
    return get(slug) !== null;
  }

  function insert(
    slug: string,
    importedAt: string | null = null,
    mode: ProjectMode = 'footage',
    brand: string | null = null,
    title: string | null = null,
  ): ProjectRecord {
    const timestamp = clock();
    const record: ProjectRecord = { slug, createdAt: timestamp, updatedAt: timestamp, importedAt, mode, brand, title };
    db.insert(projects).values(record).run();
    return record;
  }

  function touch(slug: string): void {
    db.update(projects).set({ updatedAt: clock() }).where(eq(projects.slug, slug)).run();
  }

  function setBrand(slug: string, brand: string | null): void {
    db.update(projects).set({ brand, updatedAt: clock() }).where(eq(projects.slug, slug)).run();
  }

  function remove(slug: string): void {
    db.delete(projects).where(eq(projects.slug, slug)).run();
  }

  return { list, get, exists, insert, touch, setBrand, delete: remove };
}

export type ProjectsRepository = ReturnType<typeof createProjectsRepository>;
