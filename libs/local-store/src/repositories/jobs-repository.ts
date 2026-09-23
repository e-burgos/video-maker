import { desc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { jobs } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export const UNFINISHED_JOB_STATES = ['queued', 'running', 'canceling'] as const;

export interface JobRecord {
  readonly id: string;
  readonly slug: string;
  readonly kind: string;
  readonly state: string;
  readonly params: unknown;
  readonly progress: unknown | null;
  readonly report: unknown | null;
  readonly error: unknown | null;
  readonly retryOf: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface NewJobRecord {
  readonly id: string;
  readonly slug: string;
  readonly kind: string;
  readonly state: string;
  readonly params: unknown;
  readonly createdAt: string;
  readonly retryOf?: string | null;
}

function parseJsonColumn(value: string | null): unknown | null {
  return value === null ? null : (JSON.parse(value) as unknown);
}

function toJobRecord(row: typeof jobs.$inferSelect): JobRecord {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    state: row.state,
    params: JSON.parse(row.params) as unknown,
    progress: parseJsonColumn(row.progress),
    report: parseJsonColumn(row.report),
    error: parseJsonColumn(row.error),
    retryOf: row.retryOf,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export function createJobsRepository(db: BetterSQLite3Database<typeof schema>) {
  function insert(input: NewJobRecord): JobRecord {
    const retryOf = input.retryOf ?? null;

    db
      .insert(jobs)
      .values({
        id: input.id,
        slug: input.slug,
        kind: input.kind,
        state: input.state,
        params: JSON.stringify(input.params),
        retryOf,
        createdAt: input.createdAt,
      })
      .run();

    return {
      id: input.id,
      slug: input.slug,
      kind: input.kind,
      state: input.state,
      params: input.params,
      progress: null,
      report: null,
      error: null,
      retryOf,
      createdAt: input.createdAt,
      startedAt: null,
      finishedAt: null,
    };
  }

  function updateState(
    id: string,
    state: string,
    startedAt?: string | null,
    finishedAt?: string | null,
    error?: unknown | null,
  ): void {
    const patch: Partial<typeof jobs.$inferInsert> = { state };
    if (startedAt !== undefined) {
      patch.startedAt = startedAt;
    }
    if (finishedAt !== undefined) {
      patch.finishedAt = finishedAt;
    }
    if (error !== undefined) {
      patch.error = error === null ? null : JSON.stringify(error);
    }
    db.update(jobs).set(patch).where(eq(jobs.id, id)).run();
  }

  function updateProgress(id: string, progress: unknown | null): void {
    db
      .update(jobs)
      .set({ progress: progress === null ? null : JSON.stringify(progress) })
      .where(eq(jobs.id, id))
      .run();
  }

  function setReport(id: string, report: unknown | null): void {
    db
      .update(jobs)
      .set({ report: report === null ? null : JSON.stringify(report) })
      .where(eq(jobs.id, id))
      .run();
  }

  function get(id: string): JobRecord | null {
    const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
    return row === undefined ? null : toJobRecord(row);
  }

  function listByProject(slug: string): readonly JobRecord[] {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.slug, slug))
      .orderBy(desc(jobs.createdAt))
      .all()
      .map(toJobRecord);
  }

  function listUnfinished(): readonly JobRecord[] {
    return db
      .select()
      .from(jobs)
      .where(inArray(jobs.state, UNFINISHED_JOB_STATES))
      .all()
      .map(toJobRecord);
  }

  function markInterrupted(ids: readonly string[], errorPayload: unknown, finishedAt: string): void {
    db.transaction((tx) => {
      for (const id of ids) {
        tx
          .update(jobs)
          .set({ state: 'failed', error: JSON.stringify(errorPayload), finishedAt })
          .where(eq(jobs.id, id))
          .run();
      }
    });
  }

  return {
    insert,
    updateState,
    updateProgress,
    setReport,
    get,
    listByProject,
    listUnfinished,
    markInterrupted,
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
