import type { ObjectStorage, StorageStat } from '../deps/object-storage';

export interface ProjectLayoutFlags {
  readonly raw: boolean;
  readonly catalog: boolean;
  readonly timeline: boolean;
  readonly edl: boolean;
  readonly out: boolean;
}

export interface ProjectLayoutStats {
  readonly rawHasFiles: boolean;
  readonly catalog: StorageStat | null;
  readonly timeline: StorageStat | null;
  readonly edl: StorageStat | null;
  readonly outHasFiles: boolean;
}

export function layoutFlagsFrom(stats: ProjectLayoutStats): ProjectLayoutFlags {
  return {
    raw: stats.rawHasFiles,
    catalog: stats.catalog?.kind === 'file',
    timeline: stats.timeline?.kind === 'file',
    edl: stats.edl?.kind === 'file',
    out: stats.outHasFiles,
  };
}

export async function directoryHasAnyFile(storage: ObjectStorage, path: string): Promise<boolean> {
  const entries = await storage.listDirectory(path);
  if (entries === null) {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile) {
      return true;
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory && (await directoryHasAnyFile(storage, `${path}/${entry.name}`))) {
      return true;
    }
  }
  return false;
}
