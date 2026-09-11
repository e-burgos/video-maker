import { catalogPath, readCatalog, resolveMediaProject, toAbsolutePath, workPath, writeCatalog } from '@video-maker/auto-montage';
import type { Catalog, MediaProject } from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { translateAutoMontageError } from '../../errors/translate-store-error';
import { translateEngineError } from '../../errors/translate-engine-error';
import type { RenderApiError, RenderApiErrorCode } from '../../errors/render-api-error';
import type { AssetRole } from '../../store/asset-path';
import { isAssetRole, isPortableFileName, rawDirectoryForRole } from '../../store/asset-path';
import type { CatalogRemoval } from '../../store/catalog-merge';
import { mergeProbeFailure, mergeUploadedAsset, removeCatalogAsset, toCatalogAsset } from '../../store/catalog-merge';
import { isValidProjectSlug } from '../../store/project-slug';
import { resolveProjectAssets, toAssetListEntry } from '../../store/project-assets';
import { readStoredTimelineIfPersisted } from '../../store/project-scope';
import {
  describeTimelineAssetReferences,
  findTimelineAssetReferences,
} from '../../store/timeline-asset-references';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { queryFlag } from '../query-flag';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

const PROBE_FAILURE_CODE_BY_OWN_CODE: Readonly<Partial<Record<RenderApiErrorCode, 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT'>>> = {
  MEDIA_BINARY_NOT_FOUND: 'BINARY_NOT_FOUND',
  MEDIA_COMMAND_FAILED: 'COMMAND_FAILED',
  MEDIA_OUTPUT_UNPARSEABLE: 'UNPARSEABLE_OUTPUT',
};

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function deriveProbeFailureCode(ownCode: RenderApiErrorCode): 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT' | 'UNKNOWN' {
  return PROBE_FAILURE_CODE_BY_OWN_CODE[ownCode] ?? 'UNKNOWN';
}

function withDetails(
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

function assertValidProjectSlug(slug: string): void {
  if (!isValidProjectSlug(slug)) {
    throw new PipelineStageError({
      code: 'PROJECT_SLUG_INVALID',
      stage: null,
      resource: slug,
      expected: 'a single kebab-case path segment',
    });
  }
}

export async function handleListAssets(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }

  const projectAssets = await resolveProjectAssets(deps.storage, project);

  return jsonResponse(200, {
    slug,
    source: projectAssets.source,
    assets: projectAssets.assets,
    probeFailures: projectAssets.probeFailures,
  });
}

interface AssetTarget {
  readonly role: AssetRole;
  readonly assetId: string;
}

function resolveAssetTarget(params: RouteParams): AssetTarget {
  const role = params.role ?? '';
  const filename = params.filename ?? '';

  if (!isAssetRole(role)) {
    throw new PipelineStageError({
      code: 'ASSET_ROLE_INVALID',
      stage: null,
      resource: role,
      expected: 'aroll, broll, image, audio, voice or logo',
    });
  }

  if (!isPortableFileName(filename)) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: filename,
      expected: 'a single portable path segment',
    });
  }

  return { role, assetId: `raw/${rawDirectoryForRole(role)}/${filename}` };
}

async function readCatalogOrThrow(
  deps: RenderApiDependencies,
  project: MediaProject,
  assetPersisted: boolean,
): Promise<Catalog | null> {
  try {
    return await readCatalog(project, { readTextFile: deps.storage.readTextFile });
  } catch (cause) {
    const translated = translateAutoMontageError(cause, catalogPath());
    throw withDetails(translated, { assetPersisted, catalogUpdated: false }, cause);
  }
}

export async function handleUploadAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const { role, assetId } = resolveAssetTarget(params);

  const contentLengthHeader = request.headers['content-length'];
  const contentLength = contentLengthHeader === undefined ? Number.NaN : Number(contentLengthHeader);
  if (contentLengthHeader === undefined || !Number.isFinite(contentLength) || contentLength < 0) {
    throw new PipelineStageError({
      code: 'ASSET_CONTENT_LENGTH_REQUIRED',
      stage: null,
      resource: 'content-length',
    });
  }

  const contentType = request.headers['content-type'];
  if (contentType === undefined || contentType === '') {
    throw new PipelineStageError({
      code: 'ASSET_CONTENT_TYPE_REQUIRED',
      stage: null,
      resource: 'content-type',
    });
  }

  if (contentLength > store.maxUploadBytes) {
    throw new PipelineStageError({
      code: 'ASSET_TOO_LARGE',
      stage: null,
      resource: assetId,
      expected: `at most ${store.maxUploadBytes} bytes`,
    });
  }

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const absoluteDestination = toAbsolutePath(project, assetId);

  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }

  return runtime.uploadSerializer.run(slug, async () => {
    const existing = await deps.storage.stat(absoluteDestination);
    if (existing !== null) {
      throw new PipelineStageError({ code: 'ASSET_ALREADY_EXISTS', stage: null, resource: assetId });
    }

    await deps.storage.ensureDirectory(toAbsolutePath(project, `raw/${rawDirectoryForRole(role)}`));
    const uploadsDirectory = toAbsolutePath(project, workPath('.uploads'));
    await deps.storage.ensureDirectory(uploadsDirectory);

    const outcome = await deps.storage.writeTemporary({
      directory: uploadsDirectory,
      source: request.body.stream(),
      expectedBytes: contentLength,
      limitBytes: store.maxUploadBytes,
    });

    if (outcome.kind === 'limit-exceeded') {
      throw new PipelineStageError({
        code: 'ASSET_TOO_LARGE',
        stage: null,
        resource: assetId,
        expected: `at most ${outcome.limitBytes} bytes`,
      });
    }
    if (outcome.kind === 'aborted') {
      throw new PipelineStageError({ code: 'ASSET_UPLOAD_ABORTED', stage: null, resource: assetId });
    }

    const stillFree = await deps.storage.stat(absoluteDestination);
    if (stillFree !== null) {
      await deps.storage.removeTemporary(outcome.temporaryPath);
      throw new PipelineStageError({ code: 'ASSET_ALREADY_EXISTS', stage: null, resource: assetId });
    }

    await deps.storage.promoteTemporary(outcome.temporaryPath, absoluteDestination);

    const finalStat = await deps.storage.stat(absoluteDestination);
    if (finalStat === null) {
      throw new PipelineStageError({ code: 'INTERNAL_ERROR', stage: null, resource: assetId });
    }
    const fingerprint = { sizeBytes: finalStat.sizeBytes, modifiedAtMs: finalStat.modifiedAtMs };

    const catalog = await readCatalogOrThrow(deps, project, true);

    let mediaAsset: MediaAsset;
    try {
      mediaAsset = await deps.probeAsset({ path: absoluteDestination, assetId });
    } catch (cause) {
      const translated = translateEngineError(cause, null, assetId);
      const probeFailureCode = deriveProbeFailureCode(translated.code);
      const catalogWithFailure = mergeProbeFailure(
        catalog,
        { path: assetId, errorCode: probeFailureCode },
        project.slug,
      );
      await writeCatalog(project, catalogWithFailure, {
        writeTextFile: deps.storage.writeTextFile,
        ensureDirectory: deps.storage.ensureDirectory,
      });
      throw withDetails(translated, { assetPersisted: true, catalogUpdated: true }, cause);
    }

    const catalogEntry = toCatalogAsset({ asset: mediaAsset, assetId, role, fingerprint });
    const updatedCatalog = mergeUploadedAsset(catalog, catalogEntry, project.slug);
    await writeCatalog(project, updatedCatalog, {
      writeTextFile: deps.storage.writeTextFile,
      ensureDirectory: deps.storage.ensureDirectory,
    });

    return {
      status: 201,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/projects/${slug}/files/${assetId}` },
      body: toAssetListEntry(catalogEntry),
    };
  });
}

async function applyCatalogRemoval(
  deps: RenderApiDependencies,
  project: MediaProject,
  catalog: Catalog | null,
  assetId: string,
): Promise<CatalogRemoval | null> {
  if (catalog === null) {
    return null;
  }

  const removal = removeCatalogAsset(catalog, assetId);
  if (!removal.entryRemoved && removal.removedTranscriptPaths.length === 0) {
    return removal;
  }

  for (const transcriptPath of removal.removedTranscriptPaths) {
    await deps.storage.removeFile(toAbsolutePath(project, transcriptPath));
  }

  await writeCatalog(project, removal.catalog, {
    writeTextFile: deps.storage.writeTextFile,
    ensureDirectory: deps.storage.ensureDirectory,
  });

  return removal;
}

export async function handleDeleteAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const { role, assetId } = resolveAssetTarget(params);
  const force = queryFlag(request.path, 'force');

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }

  const absolutePath = toAbsolutePath(project, assetId);

  return runtime.uploadSerializer.run(slug, async () => {
    const existing = await deps.storage.stat(absolutePath);
    if (existing === null || existing.kind !== 'file') {
      throw new PipelineStageError({ code: 'ASSET_NOT_FOUND', stage: null, resource: assetId });
    }

    const catalog = await readCatalogOrThrow(deps, project, true);
    const timeline = await readStoredTimelineIfPersisted(deps, project);
    const timelineReferences = findTimelineAssetReferences(timeline, assetId);

    if (timelineReferences.length > 0 && !force) {
      throw new PipelineStageError({
        code: 'ASSET_IN_USE',
        stage: null,
        resource: assetId,
        expected: 'an asset the stored timeline does not reference',
        hint: describeTimelineAssetReferences(timelineReferences),
      });
    }

    await deps.storage.removeFile(absolutePath);
    const removal = await applyCatalogRemoval(deps, project, catalog, assetId);

    return jsonResponse(200, {
      slug,
      deleted: {
        path: assetId,
        role,
        catalogEntryRemoved: removal?.entryRemoved ?? false,
        removedArtifacts: removal?.removedTranscriptPaths ?? [],
      },
      timelineReferences,
    });
  });
}
