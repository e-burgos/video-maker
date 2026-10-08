import { and, desc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { publications } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export const PUBLICATION_STATUSES = ['uploading', 'published', 'scheduled', 'failed'] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface PublicationRecord {
  readonly id: string;
  readonly slug: string;
  readonly platform: string;
  readonly file: string;
  readonly title: string;
  readonly videoId: string | null;
  readonly url: string | null;
  readonly privacy: string;
  readonly status: PublicationStatus;
  readonly publishAt: string | null;
  readonly publishedAt: string | null;
  readonly jobId: string | null;
  readonly createdAt: string;
}

export interface NewPublicationRecord {
  readonly id: string;
  readonly slug: string;
  readonly platform: string;
  readonly file: string;
  readonly title: string;
  readonly privacy: string;
  readonly status: PublicationStatus;
  readonly publishAt: string | null;
  readonly jobId: string | null;
  readonly createdAt: string;
}

export interface PublicationUpdate {
  readonly status: PublicationStatus;
  readonly videoId?: string | null;
  readonly url?: string | null;
  readonly privacy?: string;
  readonly publishAt?: string | null;
  readonly publishedAt?: string | null;
}

function toPublicationRecord(row: typeof publications.$inferSelect): PublicationRecord {
  return { ...row, status: row.status as PublicationStatus };
}

export function createPublicationsRepository(db: BetterSQLite3Database<typeof schema>) {
  function insert(input: NewPublicationRecord): PublicationRecord {
    db
      .insert(publications)
      .values({ ...input, videoId: null, url: null, publishedAt: null })
      .run();
    return { ...input, videoId: null, url: null, publishedAt: null };
  }

  function update(id: string, patch: PublicationUpdate): void {
    db.update(publications).set(patch).where(eq(publications.id, id)).run();
  }

  function failUploadingForJobs(jobIds: readonly string[]): void {
    if (jobIds.length === 0) {
      return;
    }
    db
      .update(publications)
      .set({ status: 'failed' })
      .where(and(eq(publications.status, 'uploading'), inArray(publications.jobId, [...jobIds])))
      .run();
  }

  function get(id: string): PublicationRecord | null {
    const row = db.select().from(publications).where(eq(publications.id, id)).get();
    return row === undefined ? null : toPublicationRecord(row);
  }

  function listByProject(slug: string): readonly PublicationRecord[] {
    return db
      .select()
      .from(publications)
      .where(eq(publications.slug, slug))
      .orderBy(desc(publications.createdAt), desc(publications.id))
      .all()
      .map(toPublicationRecord);
  }

  function latestByProject(): ReadonlyMap<string, PublicationRecord> {
    const latest = new Map<string, PublicationRecord>();
    const rows = db.select().from(publications).orderBy(desc(publications.createdAt), desc(publications.id)).all();
    for (const row of rows) {
      if (!latest.has(row.slug)) {
        latest.set(row.slug, toPublicationRecord(row));
      }
    }
    return latest;
  }

  return { insert, update, failUploadingForJobs, get, listByProject, latestByProject };
}

export type PublicationsRepository = ReturnType<typeof createPublicationsRepository>;
