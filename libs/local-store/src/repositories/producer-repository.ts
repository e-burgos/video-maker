import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { producerMessages, producerSessions } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export const PRODUCER_MESSAGE_ROLES = ['user', 'assistant'] as const;

export type ProducerMessageRole = (typeof PRODUCER_MESSAGE_ROLES)[number];

export interface ProducerMessageUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}

export interface ProducerMessage {
  readonly id: string;
  readonly role: ProducerMessageRole;
  readonly text: string;
  readonly createdAt: string;
  readonly suggestions?: readonly string[];
  readonly turnId?: string;
  readonly model?: string;
  readonly usage?: ProducerMessageUsage;
}

export interface ProducerSession {
  readonly sessionId: string;
  readonly model: string;
  readonly startedAt: string;
  readonly updatedAt: string;
}

function toProducerMessage(row: typeof producerMessages.$inferSelect): ProducerMessage {
  const suggestions = row.suggestions === null ? undefined : (JSON.parse(row.suggestions) as readonly string[]);
  const usage = row.usage === null ? undefined : (JSON.parse(row.usage) as ProducerMessageUsage);
  return {
    id: row.id,
    role: row.role as ProducerMessageRole,
    text: row.text,
    createdAt: row.createdAt,
    ...(suggestions === undefined ? {} : { suggestions }),
    ...(row.turnId === null ? {} : { turnId: row.turnId }),
    ...(row.model === null ? {} : { model: row.model }),
    ...(usage === undefined ? {} : { usage }),
  };
}

export function createProducerRepository(db: BetterSQLite3Database<typeof schema>) {
  function getConversation(slug: string): readonly ProducerMessage[] {
    return db
      .select()
      .from(producerMessages)
      .where(eq(producerMessages.slug, slug))
      .orderBy(asc(producerMessages.seq))
      .all()
      .map(toProducerMessage);
  }

  function appendMessage(slug: string, message: ProducerMessage): void {
    db.transaction((tx) => {
      const [row] = tx
        .select({ maxSeq: max(producerMessages.seq) })
        .from(producerMessages)
        .where(eq(producerMessages.slug, slug))
        .all();
      const nextSeq = (row?.maxSeq ?? 0) + 1;

      tx
        .insert(producerMessages)
        .values({
          id: message.id,
          slug,
          seq: nextSeq,
          role: message.role,
          text: message.text,
          suggestions: message.suggestions === undefined ? null : JSON.stringify(message.suggestions),
          turnId: message.turnId ?? null,
          model: message.model ?? null,
          usage: message.usage === undefined ? null : JSON.stringify(message.usage),
          createdAt: message.createdAt,
        })
        .run();
    });
  }

  function getSession(slug: string): ProducerSession | null {
    const row = db.select().from(producerSessions).where(eq(producerSessions.slug, slug)).get();
    return row === undefined
      ? null
      : { sessionId: row.sessionId, model: row.model, startedAt: row.startedAt, updatedAt: row.updatedAt };
  }

  function setSession(slug: string, session: ProducerSession): void {
    db
      .insert(producerSessions)
      .values({
        slug,
        sessionId: session.sessionId,
        model: session.model,
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
      })
      .onConflictDoUpdate({
        target: producerSessions.slug,
        set: {
          sessionId: session.sessionId,
          model: session.model,
          startedAt: session.startedAt,
          updatedAt: session.updatedAt,
        },
      })
      .run();
  }

  return { getConversation, appendMessage, getSession, setSession };
}

export type ProducerRepository = ReturnType<typeof createProducerRepository>;
