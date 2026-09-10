import { catalogPath, discoverAssets, readCatalog, toAbsolutePath } from '@video-maker/auto-montage';
import type {
  Catalog,
  DirectoryReader,
  FileStatReader,
  MediaProject,
  ProbeFailure,
} from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';

import type { ObjectStorage } from '../deps/object-storage';
import { translateAutoMontageError } from '../errors/translate-store-error';
import type { AssetRole } from './asset-path';

export interface AssetFingerprint {
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface AssetListEntry {
  readonly path: string;
  readonly role: AssetRole;
  readonly fingerprint: AssetFingerprint;
  readonly media: MediaAsset | null;
}

export interface AssetProbeFailure {
  readonly path: string;
  readonly errorCode: ProbeFailure['errorCode'];
}

export interface ProjectAssets {
  readonly source: 'catalog' | 'raw-scan';
  readonly assets: readonly AssetListEntry[];
  readonly probeFailures: readonly AssetProbeFailure[];
}

function toDirectoryReader(storage: ObjectStorage): DirectoryReader {
  return {
    readDirectory: async (path) => {
      const entries = await storage.listDirectory(path);
      if (entries === null) {
        throw new Error(`ENOENT: no such directory, scandir '${path}'`);
      }
      return entries;
    },
  };
}

function toFileStatReader(storage: ObjectStorage): FileStatReader {
  return {
    statFile: async (path) => {
      const stat = await storage.stat(path);
      if (stat === null) {
        throw new Error(`ENOENT: no such file, stat '${path}'`);
      }
      return { sizeBytes: stat.sizeBytes, modifiedAtMs: stat.modifiedAtMs };
    },
  };
}

export function toAssetListEntry(entry: Catalog['assets'][number]): AssetListEntry {
  return {
    path: entry.asset.id,
    role: entry.role,
    fingerprint: entry.fingerprint,
    media: entry.asset,
  };
}

function fromCatalog(catalog: Catalog): ProjectAssets {
  return {
    source: 'catalog',
    assets: catalog.assets.map(toAssetListEntry),
    probeFailures: catalog.probeFailures.map((failure) => ({
      path: failure.path,
      errorCode: failure.errorCode,
    })),
  };
}

async function fromRawScan(storage: ObjectStorage, project: MediaProject): Promise<ProjectAssets> {
  try {
    const { findings } = await discoverAssets(project, {
      readDirectory: toDirectoryReader(storage),
      statFile: toFileStatReader(storage),
    });

    return {
      source: 'raw-scan',
      assets: findings.map((finding) => ({
        path: finding.relativePath,
        role: finding.role,
        fingerprint: finding.fingerprint,
        media: null,
      })),
      probeFailures: [],
    };
  } catch (cause) {
    throw translateAutoMontageError(cause, 'raw');
  }
}

export async function resolveProjectAssets(
  storage: ObjectStorage,
  project: MediaProject,
): Promise<ProjectAssets> {
  const catalogAbsolutePath = toAbsolutePath(project, catalogPath());
  const catalogStat = await storage.stat(catalogAbsolutePath);

  if (catalogStat !== null && catalogStat.kind === 'file') {
    let catalog: Catalog | null;
    try {
      catalog = await readCatalog(project, { readTextFile: storage.readTextFile });
    } catch (cause) {
      throw translateAutoMontageError(cause, catalogPath());
    }

    if (catalog !== null) {
      return fromCatalog(catalog);
    }
  }

  return fromRawScan(storage, project);
}

export function countAssetsByRole(
  entries: readonly { readonly role: AssetRole }[],
): Readonly<Record<AssetRole, number>> {
  const counts: Record<AssetRole, number> = { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0 };
  for (const entry of entries) {
    counts[entry.role] += 1;
  }
  return counts;
}
