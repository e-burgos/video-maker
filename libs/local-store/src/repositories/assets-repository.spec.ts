import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '../database/migrations';
import * as schema from '../schema/studio-schema';
import { createAssetsRepository } from './assets-repository';
import { createProjectsRepository } from './projects-repository';

describe('createAssetsRepository', () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;
  let clockValues: string[];

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    db = drizzle(sqlite, { schema });
    createProjectsRepository(db, () => 'now').insert('video-a');
    clockValues = ['2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z', '2026-01-01T00:02:00.000Z'];
  });

  afterEach(() => {
    sqlite.close();
  });

  function repositoryWithClock() {
    let index = 0;
    return createAssetsRepository(db, () => {
      const value = clockValues[index] ?? clockValues[clockValues.length - 1] ?? 'now';
      index += 1;
      return value;
    });
  }

  it('inserts a pending asset with a JSON probe and null confirmation fields', () => {
    const repository = repositoryWithClock();

    const record = repository.insertPending({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/clip.mp4',
      fileName: 'clip.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: { kind: 'video', durationMs: 1000, hasAudio: true },
    });

    expect(record).toEqual({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/clip.mp4',
      fileName: 'clip.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      confirmedRole: null,
      status: 'pending',
      probe: { kind: 'video', durationMs: 1000, hasAudio: true },
      createdAt: '2026-01-01T00:00:00.000Z',
      confirmedAt: null,
    });
    expect(repository.get('asset-1')).toEqual(record);
  });

  it('returns null for an unknown asset id', () => {
    expect(repositoryWithClock().get('missing')).toBeNull();
  });

  it('lists only pending assets for a project, oldest first', () => {
    const repository = repositoryWithClock();
    repository.insertPending({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });
    repository.insertPending({
      id: 'asset-2',
      slug: 'video-a',
      path: 'raw/inbox/b.mp4',
      fileName: 'b.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: {},
    });
    repository.confirm('asset-1', 'broll', 'raw/broll/a.mp4');

    expect(repository.listPending('video-a').map((asset) => asset.id)).toEqual(['asset-2']);
  });

  it('confirms an asset, moving its role, path and status and stamping confirmedAt', () => {
    const repository = repositoryWithClock();
    repository.insertPending({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });

    const confirmed = repository.confirm('asset-1', 'aroll', 'raw/aroll/a.mp4');

    expect(confirmed).toMatchObject({
      id: 'asset-1',
      confirmedRole: 'aroll',
      path: 'raw/aroll/a.mp4',
      status: 'confirmed',
      confirmedAt: '2026-01-01T00:01:00.000Z',
    });
    expect(repository.get('asset-1')?.status).toBe('confirmed');
  });

  it('returns null from confirm for an unknown asset id', () => {
    expect(repositoryWithClock().confirm('missing', 'aroll', 'raw/aroll/a.mp4')).toBeNull();
  });

  it('removes an asset row', () => {
    const repository = repositoryWithClock();
    repository.insertPending({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });

    repository.delete('asset-1');

    expect(repository.get('asset-1')).toBeNull();
  });

  it('cascades asset deletion when its project is removed', () => {
    const repository = repositoryWithClock();
    repository.insertPending({
      id: 'asset-1',
      slug: 'video-a',
      path: 'raw/inbox/a.mp4',
      fileName: 'a.mp4',
      proposedRole: 'broll',
      proposalReason: 'no-audio',
      probe: {},
    });

    createProjectsRepository(db).delete('video-a');

    expect(repository.get('asset-1')).toBeNull();
  });
});
