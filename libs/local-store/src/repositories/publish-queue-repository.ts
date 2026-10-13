import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { publishQueue } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export const PUBLISH_QUEUE_STATUSES = ['queued', 'publishing', 'published', 'already-published', 'failed'] as const;

export type PublishQueueStatus = (typeof PUBLISH_QUEUE_STATUSES)[number];

export interface PublishQueueMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly privacy: string;
  readonly publishAt?: string;
  readonly playlistIds?: readonly string[];
  readonly thumbnail?: string;
  readonly categoryId?: string;
  readonly madeForKids?: boolean;
  readonly defaultLanguage?: string;
  readonly ignoreReview?: boolean;
}

export interface PublishQueueRecord {
  readonly id: string;
  readonly slug: string;
  readonly file: string;
  readonly metadata: PublishQueueMetadata;
  readonly position: number;
  readonly status: PublishQueueStatus;
  readonly attempts: number;
  readonly lastError: unknown | null;
  readonly nextAttemptAt: string | null;
  readonly jobId: string | null;
  readonly url: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewPublishQueueRecord {
  readonly id: string;
  readonly slug: string;
  readonly file: string;
  readonly metadata: PublishQueueMetadata;
  readonly createdAt: string;
}

export interface PublishQueueUpdate {
  readonly metadata?: PublishQueueMetadata;
  readonly status?: PublishQueueStatus;
  readonly attempts?: number;
  readonly lastError?: unknown | null;
  readonly nextAttemptAt?: string | null;
  readonly jobId?: string | null;
  readonly url?: string | null;
  readonly updatedAt: string;
}

function toRecord(row: typeof publishQueue.$inferSelect): PublishQueueRecord {
  return {
    id: row.id,
    slug: row.slug,
    file: row.file,
    metadata: JSON.parse(row.metadata) as PublishQueueMetadata,
    position: row.position,
    status: row.status as PublishQueueStatus,
    attempts: row.attempts,
    lastError: row.lastError === null ? null : (JSON.parse(row.lastError) as unknown),
    nextAttemptAt: row.nextAttemptAt,
    jobId: row.jobId,
    url: row.url,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPublishQueueRepository(db: BetterSQLite3Database<typeof schema>) {
  function list(): readonly PublishQueueRecord[] {
    return db.select().from(publishQueue).orderBy(asc(publishQueue.position), asc(publishQueue.id)).all().map(toRecord);
  }

  function get(id: string): PublishQueueRecord | null {
    const row = db.select().from(publishQueue).where(eq(publishQueue.id, id)).get();
    return row === undefined ? null : toRecord(row);
  }

  function insert(input: NewPublishQueueRecord): PublishQueueRecord {
    const last = db.select({ value: max(publishQueue.position) }).from(publishQueue).get();
    const position = (last?.value ?? -1) + 1;
    db
      .insert(publishQueue)
      .values({
        id: input.id,
        slug: input.slug,
        file: input.file,
        metadata: JSON.stringify(input.metadata),
        position,
        status: 'queued',
        attempts: 0,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .run();
    return {
      ...input,
      position,
      status: 'queued',
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
      jobId: null,
      url: null,
      updatedAt: input.createdAt,
    };
  }

  function update(id: string, patch: PublishQueueUpdate): void {
    const { metadata, lastError, ...rest } = patch;
    db
      .update(publishQueue)
      .set({
        ...rest,
        ...(metadata === undefined ? {} : { metadata: JSON.stringify(metadata) }),
        ...(lastError === undefined ? {} : { lastError: lastError === null ? null : JSON.stringify(lastError) }),
      })
      .where(eq(publishQueue.id, id))
      .run();
  }

  function move(id: string, targetPosition: number): void {
    const ordered = list().map((record) => record.id);
    const from = ordered.indexOf(id);
    if (from === -1) {
      return;
    }
    ordered.splice(from, 1);
    const to = Math.min(Math.max(targetPosition, 0), ordered.length);
    ordered.splice(to, 0, id);
    ordered.forEach((itemId, index) => {
      db.update(publishQueue).set({ position: index }).where(eq(publishQueue.id, itemId)).run();
    });
  }

  function remove(id: string): void {
    db.delete(publishQueue).where(eq(publishQueue.id, id)).run();
  }

  function nextDue(nowIso: string): PublishQueueRecord | null {
    return (
      list().find(
        (record) =>
          record.status === 'queued' && (record.nextAttemptAt === null || record.nextAttemptAt <= nowIso),
      ) ?? null
    );
  }

  function earliestNextAttemptAt(): string | null {
    const waiting = list()
      .filter((record) => record.status === 'queued' && record.nextAttemptAt !== null)
      .map((record) => record.nextAttemptAt as string)
      .sort();
    return waiting[0] ?? null;
  }

  return { list, get, insert, update, move, remove, nextDue, earliestNextAttemptAt };
}

export type PublishQueueRepository = ReturnType<typeof createPublishQueueRepository>;
