import { catalogPath, readCatalog, writeCatalog } from '@video-maker/auto-montage';
import type { Catalog, CatalogAsset, MediaProject } from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateAutoMontageError } from '../errors/translate-store-error';
import { translateEngineError } from '../errors/translate-engine-error';
import type { RenderApiError, RenderApiErrorCode } from '../errors/render-api-error';
import type { AssetRole } from './asset-path';
import { mergeProbeFailure, mergeUploadedAsset, toCatalogAsset } from './catalog-merge';

const PROBE_FAILURE_CODE_BY_OWN_CODE: Readonly<
  Partial<Record<RenderApiErrorCode, 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT'>>
> = {
  MEDIA_BINARY_NOT_FOUND: 'BINARY_NOT_FOUND',
  MEDIA_COMMAND_FAILED: 'COMMAND_FAILED',
  MEDIA_OUTPUT_UNPARSEABLE: 'UNPARSEABLE_OUTPUT',
};

function deriveProbeFailureCode(
  ownCode: RenderApiErrorCode,
): 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT' | 'UNKNOWN' {
  return PROBE_FAILURE_CODE_BY_OWN_CODE[ownCode] ?? 'UNKNOWN';
}

export function withCatalogDetails(
  error: RenderApiError,
  details: { readonly assetPersisted: boolean; readonly catalogUpdated: boolean },
  cause: unknown,
): PipelineStageError {
  return new PipelineStageError({
    code: error.code,
    stage: null,
    resource: error.resource,
    expected: error.expected,
    hint: error.hint,
    details,
    cause,
  });
}

export async function readCatalogOrThrow(
  deps: RenderApiDependencies,
  project: MediaProject,
  assetPersisted: boolean,
): Promise<Catalog | null> {
  try {
    return await readCatalog(project, { readTextFile: deps.storage.readTextFile });
  } catch (cause) {
    const translated = translateAutoMontageError(cause, catalogPath());
    throw withCatalogDetails(translated, { assetPersisted, catalogUpdated: false }, cause);
  }
}

export interface IngestAssetIntoCatalogInput {
  readonly project: MediaProject;
  readonly assetId: string;
  readonly role: AssetRole;
  readonly absolutePath: string;
}

export async function ingestAssetIntoCatalog(
  deps: RenderApiDependencies,
  input: IngestAssetIntoCatalogInput,
): Promise<CatalogAsset> {
  const { project, assetId, role, absolutePath } = input;

  const finalStat = await deps.storage.stat(absolutePath);
  if (finalStat === null) {
    throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null, resource: assetId });
  }
  const fingerprint = { sizeBytes: finalStat.sizeBytes, modifiedAtMs: finalStat.modifiedAtMs };

  const catalog = await readCatalogOrThrow(deps, project, true);

  let mediaAsset: MediaAsset;
  try {
    mediaAsset = await deps.probeAsset({ path: absolutePath, assetId });
  } catch (cause) {
    const translated = translateEngineError(cause, null, assetId);
    const probeFailureCode = deriveProbeFailureCode(translated.code);
    const catalogWithFailure = mergeProbeFailure(catalog, { path: assetId, errorCode: probeFailureCode }, project.slug);
    await writeCatalog(project, catalogWithFailure, {
      writeTextFile: deps.storage.writeTextFile,
      ensureDirectory: deps.storage.ensureDirectory,
    });
    throw withCatalogDetails(translated, { assetPersisted: true, catalogUpdated: true }, cause);
  }

  const catalogEntry = toCatalogAsset({ asset: mediaAsset, assetId, role, fingerprint });
  const updatedCatalog = mergeUploadedAsset(catalog, catalogEntry, project.slug);
  await writeCatalog(project, updatedCatalog, {
    writeTextFile: deps.storage.writeTextFile,
    ensureDirectory: deps.storage.ensureDirectory,
  });

  return catalogEntry;
}
