import { catalogPath, discoverAssets, readCatalog, toAbsolutePath } from '@video-maker/auto-montage';
import type {
  AssetRole as CatalogAssetRole,
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
import { isAssetRole } from './asset-path';

export interface AssetFingerprint {
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface AssetListEntry {
  readonly path: string;
  readonly role: CatalogAssetRole;
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

async function scanRawFindings(storage: ObjectStorage, project: MediaProject): Promise<readonly AssetListEntry[] | null> {
  try {
    const { findings } = await discoverAssets(project, {
      readDirectory: toDirectoryReader(storage),
      statFile: toFileStatReader(storage),
    });
    return findings.map((finding) => ({
      path: finding.relativePath,
      role: finding.role,
      fingerprint: finding.fingerprint,
      media: null,
    }));
  } catch {
    return null;
  }
}

function mergeRawFindings(catalogAssets: ProjectAssets, rawEntries: readonly AssetListEntry[] | null): ProjectAssets {
  if (rawEntries === null) {
    return catalogAssets;
  }
  const onDisk = new Set(rawEntries.map((entry) => entry.path));
  const catalogued = new Set(catalogAssets.assets.map((entry) => entry.path));
  return {
    ...catalogAssets,
    assets: [
      ...catalogAssets.assets.filter((entry) => onDisk.has(entry.path)),
      ...rawEntries.filter((entry) => !catalogued.has(entry.path)),
    ],
  };
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
      return mergeRawFindings(fromCatalog(catalog), await scanRawFindings(storage, project));
    }
  }

  return fromRawScan(storage, project);
}

export function countAssetsByRole(
  entries: readonly { readonly role: CatalogAssetRole }[],
): Readonly<Record<AssetRole, number>> {
  const counts: Record<AssetRole, number> = { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0, reference: 0 };
  for (const entry of entries) {
    if (isAssetRole(entry.role)) {
      counts[entry.role] += 1;
    }
  }
  return counts;
}
