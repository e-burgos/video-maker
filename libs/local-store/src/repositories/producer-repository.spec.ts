import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createProducerRepository } from './producer-repository';
import { createProjectsRepository } from './projects-repository';

describe('createProducerRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    createProjectsRepository(db, () => 'now').insert('video-a');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('returns an empty conversation for a project with no messages', () => {
    const repository = createProducerRepository(db);
    expect(repository.getConversation('video-a')).toEqual([]);
  });

  it('appends messages, assigning seq in order and round-tripping optional fields', () => {
    const repository = createProducerRepository(db);
    repository.appendMessage('video-a', {
      id: 'm1',
      role: 'user',
      text: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
      turnId: 'turn-1',
    });
    repository.appendMessage('video-a', {
      id: 'm2',
      role: 'assistant',
      text: 'hi there',
      createdAt: '2026-01-01T00:01:00.000Z',
      turnId: 'turn-1',
      model: 'sonnet',
      suggestions: ['do this', 'do that'],
    });

    expect(repository.getConversation('video-a')).toEqual([
      { id: 'm1', role: 'user', text: 'hello', createdAt: '2026-01-01T00:00:00.000Z', turnId: 'turn-1' },
      {
        id: 'm2',
        role: 'assistant',
        text: 'hi there',
        createdAt: '2026-01-01T00:01:00.000Z',
        turnId: 'turn-1',
        model: 'sonnet',
        suggestions: ['do this', 'do that'],
      },
    ]);
  });

  it('rejects a duplicate seq for the same project through the unique constraint', () => {
    const repository = createProducerRepository(db);
    repository.appendMessage('video-a', { id: 'm1', role: 'user', text: 'hello', createdAt: 'now' });

    expect(() =>
      db
        .insert(schema.producerMessages)
        .values({ id: 'm2', slug: 'video-a', seq: 1, role: 'user', text: 'dup', createdAt: 'now' })
        .run(),
    ).toThrow();
  });

  it('rolls back appendMessage entirely when the insert violates a constraint', () => {
    const repository = createProducerRepository(db);

    expect(() =>
      repository.appendMessage('unknown-project', { id: 'm1', role: 'user', text: 'hi', createdAt: 'now' }),
    ).toThrow();

    expect(db.select().from(schema.producerMessages).all()).toHaveLength(0);
  });

  it('keeps seq numbering independent per project', () => {
    createProjectsRepository(db, () => 'now').insert('video-b');
    const repository = createProducerRepository(db);

    repository.appendMessage('video-a', { id: 'a1', role: 'user', text: 'a', createdAt: 'now' });
    repository.appendMessage('video-b', { id: 'b1', role: 'user', text: 'b', createdAt: 'now' });
    repository.appendMessage('video-a', { id: 'a2', role: 'assistant', text: 'a2', createdAt: 'now' });

    expect(repository.getConversation('video-a').map((message) => message.id)).toEqual(['a1', 'a2']);
    expect(repository.getConversation('video-b').map((message) => message.id)).toEqual(['b1']);
  });

  it('reads and writes the producer session', () => {
    const repository = createProducerRepository(db);
    expect(repository.getSession('video-a')).toBeNull();

    repository.setSession('video-a', {
      sessionId: 'session-1',
      model: 'sonnet',
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(repository.getSession('video-a')).toEqual({
      sessionId: 'session-1',
      model: 'sonnet',
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('overwrites the session on a second setSession for the same project', () => {
    const repository = createProducerRepository(db);
    repository.setSession('video-a', {
      sessionId: 'session-1',
      model: 'sonnet',
      startedAt: 'a',
      updatedAt: 'a',
    });
    repository.setSession('video-a', {
      sessionId: 'session-1',
      model: 'opus',
      startedAt: 'a',
      updatedAt: 'b',
    });

    expect(repository.getSession('video-a')?.model).toBe('opus');
    expect(repository.getSession('video-a')?.updatedAt).toBe('b');
  });
});
