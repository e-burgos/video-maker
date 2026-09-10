import { CATALOG_SCHEMA_VERSION } from '@video-maker/auto-montage';
import type {
  AssetRole as CatalogAssetRole,
  Catalog,
  CatalogAsset,
  ProbeFailure,
  ProjectRelativePath,
} from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';

const MESSAGE_BY_PROBE_FAILURE_CODE: Readonly<Record<ProbeFailure['errorCode'], string>> = {
  BINARY_NOT_FOUND: 'A required media binary could not be resolved.',
  COMMAND_FAILED: 'A media command exited with a non-zero status.',
  UNPARSEABLE_OUTPUT: 'A media command ran but its output could not be parsed.',
  UNKNOWN: 'The asset could not be probed for an unknown reason.',
};

export interface ToCatalogAssetInput {
  readonly asset: MediaAsset;
  readonly assetId: ProjectRelativePath;
  readonly role: CatalogAssetRole;
  readonly fingerprint: { readonly sizeBytes: number; readonly modifiedAtMs: number };
}

export interface UploadProbeFailure {
  readonly path: ProjectRelativePath;
  readonly errorCode: ProbeFailure['errorCode'];
}

function compareByString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

export function emptyCatalogFor(slug: string): Catalog {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: slug,
    assets: [],
    transcripts: [],
    ignored: [],
    probeFailures: [],
  };
}

export function toCatalogAsset(input: ToCatalogAssetInput): CatalogAsset {
  return {
    role: input.role,
    fingerprint: input.fingerprint,
    asset: { ...input.asset, id: input.assetId, path: input.assetId },
  };
}

export function mergeUploadedAsset(previous: Catalog | null, entry: CatalogAsset, slug: string): Catalog {
  const base = previous ?? emptyCatalogFor(slug);

  const assets = [...base.assets.filter((existing) => existing.asset.id !== entry.asset.id), entry].sort(
    (left, right) => compareByString(left.asset.id, right.asset.id),
  );
  const probeFailures = base.probeFailures.filter((failure) => failure.path !== entry.asset.id);

  return { ...base, assets, probeFailures };
}

export function mergeProbeFailure(previous: Catalog | null, failure: UploadProbeFailure, slug: string): Catalog {
  const base = previous ?? emptyCatalogFor(slug);

  const entry: ProbeFailure = {
    path: failure.path,
    errorCode: failure.errorCode,
    message: MESSAGE_BY_PROBE_FAILURE_CODE[failure.errorCode],
  };

  const probeFailures = [...base.probeFailures.filter((existing) => existing.path !== failure.path), entry].sort(
    (left, right) => compareByString(left.path, right.path),
  );

  return { ...base, probeFailures };
}
