import type { StorageStat } from '../deps/object-storage';

export interface ProjectLayoutFlags {
  readonly raw: boolean;
  readonly catalog: boolean;
  readonly timeline: boolean;
  readonly edl: boolean;
  readonly out: boolean;
}

export interface ProjectLayoutStats {
  readonly raw: StorageStat | null;
  readonly catalog: StorageStat | null;
  readonly timeline: StorageStat | null;
  readonly edl: StorageStat | null;
  readonly out: StorageStat | null;
}

export function layoutFlagsFrom(stats: ProjectLayoutStats): ProjectLayoutFlags {
  return {
    raw: stats.raw?.kind === 'directory',
    catalog: stats.catalog?.kind === 'file',
    timeline: stats.timeline?.kind === 'file',
    edl: stats.edl?.kind === 'file',
    out: stats.out?.kind === 'directory',
  };
}
