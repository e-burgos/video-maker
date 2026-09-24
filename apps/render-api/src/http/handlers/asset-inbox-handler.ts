import { isSupportedExtension, resolveMediaProject, toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { AssetRecord } from '@video-maker/local-store';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { translateEngineError } from '../../errors/translate-engine-error';
import { INBOX_RAW_DIRECTORY, inboxAssetId, pickAvailableFileName, toAssetProbeSummary } from '../../store/asset-inbox';
import type { AssetRole } from '../../store/asset-path';
import { isAssetRole, isPortableFileName, rawDirectoryForRole } from '../../store/asset-path';
import { ingestAssetIntoCatalog } from '../../store/ingest-asset-into-catalog';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { proposeAssetRole } from '../../store/propose-asset-role';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

interface AssetPayload {
  readonly id: string;
  readonly fileName: string;
  readonly path: string;
  readonly proposedRole: string;
  readonly proposalReason: string;
  readonly probe: unknown;
  readonly status: string;
  readonly confirmedRole?: string;
}

function toAssetPayload(record: AssetRecord): AssetPayload {
  return {
    id: record.id,
    fileName: record.fileName,
    path: record.path,
    proposedRole: record.proposedRole,
    proposalReason: record.proposalReason,
    probe: record.probe,
    status: record.status,
    ...(record.confirmedRole === null ? {} : { confirmedRole: record.confirmedRole }),
  };
}

async function assertProjectExists(deps: RenderApiDependencies, store: StoreConfig, slug: string) {
  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }
  return project;
}

function getPendingAssetOrThrow(deps: RenderApiDependencies, slug: string, assetId: string): AssetRecord {
  const record = deps.localStore.assets.get(assetId);
  if (record === null || record.slug !== slug || record.status !== 'pending') {
    throw new PipelineStageError({ code: 'INBOX_ASSET_NOT_FOUND', stage: null, resource: assetId });
  }
  return record;
}

export async function handleUploadToInbox(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const filename = params.filename ?? '';
  if (!isPortableFileName(filename)) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: filename,
      expected: 'a single portable path segment',
    });
  }
  if (!isSupportedExtension(filename)) {
    throw new PipelineStageError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      stage: null,
      resource: filename,
      expected: 'a supported video, image or audio extension',
    });
  }

  const contentLengthHeader = request.headers['content-length'];
  const contentLength = contentLengthHeader === undefined ? Number.NaN : Number(contentLengthHeader);
  if (contentLengthHeader === undefined || !Number.isFinite(contentLength) || contentLength < 0) {
    throw new PipelineStageError({ code: 'ASSET_CONTENT_LENGTH_REQUIRED', stage: null, resource: 'content-length' });
  }

  const contentType = request.headers['content-type'];
  if (contentType === undefined || contentType === '') {
    throw new PipelineStageError({ code: 'ASSET_CONTENT_TYPE_REQUIRED', stage: null, resource: 'content-type' });
  }

  if (contentLength > store.maxUploadBytes) {
    throw new PipelineStageError({
      code: 'ASSET_TOO_LARGE',
      stage: null,
      resource: filename,
      expected: `at most ${store.maxUploadBytes} bytes`,
    });
  }

  const project = await resolveExistingProject(deps, store, slug);
  const inboxDirectory = toAbsolutePath(project, INBOX_RAW_DIRECTORY);

  return runtime.uploadSerializer.run(slug, async () => {
    await deps.storage.ensureDirectory(inboxDirectory);
    const finalFileName = await pickAvailableFileName(deps.storage, inboxDirectory, filename);
    const assetId = inboxAssetId(finalFileName);
    const absoluteDestination = toAbsolutePath(project, assetId);

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

    await deps.storage.promoteTemporary(outcome.temporaryPath, absoluteDestination);

    let probeSummary: ReturnType<typeof toAssetProbeSummary>;
    try {
      const mediaAsset = await deps.probeAsset({ path: absoluteDestination, assetId });
      probeSummary = toAssetProbeSummary(mediaAsset);
    } catch (cause) {
      throw translateEngineError(cause, null, assetId);
    }

    const proposal = proposeAssetRole(probeSummary, finalFileName);

    const record = deps.localStore.assets.insertPending({
      id: deps.randomId(),
      slug,
      path: assetId,
      fileName: finalFileName,
      proposedRole: proposal.role,
      proposalReason: proposal.reason,
      probe: probeSummary,
    });

    return {
      status: 201,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/projects/${slug}/files/${assetId}` },
      body: { asset: toAssetPayload(record) },
    };
  });
}

export async function handleListInbox(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  await assertProjectExists(deps, store, slug);

  const pending = deps.localStore.assets.listPending(slug);
  return jsonResponse(200, { assets: pending.map(toAssetPayload) });
}

interface ConfirmInboxAssetBody {
  readonly role: AssetRole;
}

function parseConfirmInboxAssetBody(value: unknown): ConfirmInboxAssetBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const role = bodyObject.role;
  if (typeof role !== 'string' || !isAssetRole(role)) {
    throw new PipelineStageError({
      code: 'ASSET_ROLE_INVALID',
      stage: null,
      resource: typeof role === 'string' ? role : '',
      expected: 'aroll, broll, image, audio, voice or logo',
    });
  }
  return { role };
}

export async function handleConfirmInboxAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const assetId = params.assetId ?? '';

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { role } = parseConfirmInboxAssetBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await assertProjectExists(deps, store, slug);

  return runtime.uploadSerializer.run(slug, async () => {
    const pendingRecord = getPendingAssetOrThrow(deps, slug, assetId);

    const sourceAbsolutePath = toAbsolutePath(project, pendingRecord.path);
    const sourceStat = await deps.storage.stat(sourceAbsolutePath);
    if (sourceStat === null || sourceStat.kind !== 'file') {
      throw new PipelineStageError({ code: 'INBOX_ASSET_NOT_FOUND', stage: null, resource: assetId });
    }

    const targetDirectory = toAbsolutePath(project, `raw/${rawDirectoryForRole(role)}`);
    await deps.storage.ensureDirectory(targetDirectory);
    const finalFileName = await pickAvailableFileName(deps.storage, targetDirectory, pendingRecord.fileName);
    const targetAssetId = `raw/${rawDirectoryForRole(role)}/${finalFileName}`;
    const targetAbsolutePath = toAbsolutePath(project, targetAssetId);

    await deps.storage.copyFile(sourceAbsolutePath, targetAbsolutePath);
    await deps.storage.removeFile(sourceAbsolutePath);

    const confirmed = deps.localStore.assets.confirm(assetId, role, targetAssetId);
    if (confirmed === null) {
      throw new PipelineStageError({ code: 'INBOX_ASSET_NOT_FOUND', stage: null, resource: assetId });
    }

    await ingestAssetIntoCatalog(deps, { project, assetId: targetAssetId, role, absolutePath: targetAbsolutePath });

    return jsonResponse(200, { asset: toAssetPayload(confirmed) });
  });
}

export async function handleDeleteInboxAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const assetId = params.assetId ?? '';

  const project = await assertProjectExists(deps, store, slug);

  return runtime.uploadSerializer.run(slug, async () => {
    const pendingRecord = getPendingAssetOrThrow(deps, slug, assetId);

    const absolutePath = toAbsolutePath(project, pendingRecord.path);
    const fileStat = await deps.storage.stat(absolutePath);
    if (fileStat !== null) {
      await deps.storage.removeFile(absolutePath);
    }

    deps.localStore.assets.delete(assetId);

    return jsonResponse(200, { slug, deleted: { id: assetId, path: pendingRecord.path } });
  });
}
