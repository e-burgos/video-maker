import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { categories, folders, placements } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export interface VideoCategory {
  readonly id: string;
  readonly name: string;
}

export interface VideoFolder {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly VideoCategory[];
}

export interface VideoPlacement {
  readonly folderId: string | null;
  readonly categoryId: string | null;
  readonly archived: boolean;
}

export interface Organization {
  readonly folders: readonly VideoFolder[];
  readonly videos: Readonly<Record<string, VideoPlacement>>;
}

export const EMPTY_ORGANIZATION: Organization = { folders: [], videos: {} };

export const UNPLACED_VIDEO: VideoPlacement = { folderId: null, categoryId: null, archived: false };

function isDefaultPlacement(placement: VideoPlacement): boolean {
  return placement.folderId === null && placement.categoryId === null && !placement.archived;
}

function nextPosition(rows: readonly { readonly position: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

export function createOrganizationRepository(db: BetterSQLite3Database<typeof schema>) {
  function getOrganization(): Organization {
    const folderRows = db.select().from(folders).orderBy(asc(folders.position)).all();
    const categoryRows = db.select().from(categories).orderBy(asc(categories.position)).all();
    const placementRows = db.select().from(placements).all();

    const organizationFolders: readonly VideoFolder[] = folderRows.map((folder) => ({
      id: folder.id,
      name: folder.name,
      categories: categoryRows
        .filter((category) => category.folderId === folder.id)
        .map((category) => ({ id: category.id, name: category.name })),
    }));

    const videos: Record<string, VideoPlacement> = {};
    for (const row of placementRows) {
      const placement: VideoPlacement = {
        folderId: row.folderId,
        categoryId: row.categoryId,
        archived: row.archived,
      };
      if (!isDefaultPlacement(placement)) {
        videos[row.slug] = placement;
      }
    }

    return { folders: organizationFolders, videos };
  }

  function createFolder(id: string, name: string): void {
    const rows = db.select({ position: folders.position }).from(folders).all();
    db.insert(folders).values({ id, name, position: nextPosition(rows) }).run();
  }

  function renameFolder(id: string, name: string): void {
    db.update(folders).set({ name }).where(eq(folders.id, id)).run();
  }

  function deleteFolder(id: string): void {
    db.delete(folders).where(eq(folders.id, id)).run();
  }

  function createCategory(id: string, folderId: string, name: string): void {
    const rows = db
      .select({ position: categories.position })
      .from(categories)
      .where(eq(categories.folderId, folderId))
      .all();
    db.insert(categories).values({ id, folderId, name, position: nextPosition(rows) }).run();
  }

  function deleteCategory(id: string): void {
    db.delete(categories).where(eq(categories.id, id)).run();
  }

  function setPlacement(slug: string, placement: VideoPlacement): void {
    if (isDefaultPlacement(placement)) {
      db.delete(placements).where(eq(placements.slug, slug)).run();
      return;
    }

    db
      .insert(placements)
      .values({
        slug,
        folderId: placement.folderId,
        categoryId: placement.categoryId,
        archived: placement.archived,
      })
      .onConflictDoUpdate({
        target: placements.slug,
        set: {
          folderId: placement.folderId,
          categoryId: placement.categoryId,
          archived: placement.archived,
        },
      })
      .run();
  }

  return {
    getOrganization,
    createFolder,
    renameFolder,
    deleteFolder,
    createCategory,
    deleteCategory,
    setPlacement,
  };
}

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;
