import { and, asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { assets } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export const ASSET_STATUSES = ['pending', 'confirmed'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export interface AssetRecord {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
  readonly fileName: string;
  readonly proposedRole: string;
  readonly proposalReason: string;
  readonly confirmedRole: string | null;
  readonly status: AssetStatus;
  readonly probe: unknown;
  readonly createdAt: string;
  readonly confirmedAt: string | null;
}

export interface NewPendingAssetRecord {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
  readonly fileName: string;
  readonly proposedRole: string;
  readonly proposalReason: string;
  readonly probe: unknown;
}

export type AssetsClock = () => string;

const defaultClock: AssetsClock = () => new Date().toISOString();

function toAssetRecord(row: typeof assets.$inferSelect): AssetRecord {
  return {
    id: row.id,
    slug: row.slug,
    path: row.path,
    fileName: row.fileName,
    proposedRole: row.proposedRole,
    proposalReason: row.proposalReason,
    confirmedRole: row.confirmedRole,
    status: row.status as AssetStatus,
    probe: JSON.parse(row.probe) as unknown,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
  };
}

export function createAssetsRepository(
  db: BetterSQLite3Database<typeof schema>,
  clock: AssetsClock = defaultClock,
) {
  function insertPending(input: NewPendingAssetRecord): AssetRecord {
    const createdAt = clock();
    db
      .insert(assets)
      .values({
        id: input.id,
        slug: input.slug,
        path: input.path,
        fileName: input.fileName,
        proposedRole: input.proposedRole,
        proposalReason: input.proposalReason,
        confirmedRole: null,
        status: 'pending',
        probe: JSON.stringify(input.probe),
        createdAt,
        confirmedAt: null,
      })
      .run();

    return {
      id: input.id,
      slug: input.slug,
      path: input.path,
      fileName: input.fileName,
      proposedRole: input.proposedRole,
      proposalReason: input.proposalReason,
      confirmedRole: null,
      status: 'pending',
      probe: input.probe,
      createdAt,
      confirmedAt: null,
    };
  }

  function listPending(slug: string): readonly AssetRecord[] {
    return db
      .select()
      .from(assets)
      .where(and(eq(assets.slug, slug), eq(assets.status, 'pending' satisfies AssetStatus)))
      .orderBy(asc(assets.createdAt))
      .all()
      .map(toAssetRecord);
  }

  function get(id: string): AssetRecord | null {
    const row = db.select().from(assets).where(eq(assets.id, id)).get();
    return row === undefined ? null : toAssetRecord(row);
  }

  function confirm(id: string, role: string, newPath: string): AssetRecord | null {
    const confirmedAt = clock();
    db
      .update(assets)
      .set({ confirmedRole: role, path: newPath, status: 'confirmed' satisfies AssetStatus, confirmedAt })
      .where(eq(assets.id, id))
      .run();
    return get(id);
  }

  function remove(id: string): void {
    db.delete(assets).where(eq(assets.id, id)).run();
  }

  return { insertPending, listPending, get, confirm, delete: remove };
}

export type AssetsRepository = ReturnType<typeof createAssetsRepository>;
