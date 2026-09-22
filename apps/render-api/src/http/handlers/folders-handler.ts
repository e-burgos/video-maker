import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import {
  addCategory,
  addFolder,
  findCategory,
  findFolder,
  normalizeName,
  removeCategory,
  removeFolder,
  renameFolder,
  toIdentifier,
} from '../../store/organization';
import type { Organization, VideoFolder } from '../../store/organization';
import { readOrganization, writeOrganization } from '../../store/organization-store';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

async function readNameFromBody(request: HttpRequestLine): Promise<string> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);

  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind !== 'parsed') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const value = bodyResult.value;
  const candidate =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as { name?: unknown }).name
      : undefined;

  if (typeof candidate !== 'string') {
    throw new PipelineStageError({
      code: 'FOLDER_NAME_INVALID',
      stage: null,
      expected: 'a name string',
    });
  }

  const name = normalizeName(candidate);
  if (name === '' || toIdentifier(name) === '') {
    throw new PipelineStageError({
      code: 'FOLDER_NAME_INVALID',
      stage: null,
      resource: candidate,
      expected: 'a name holding at least one letter or digit',
    });
  }

  return name;
}

function requireFolder(organization: Organization, folderId: string): VideoFolder {
  const folder = findFolder(organization, folderId);
  if (folder === null) {
    throw new PipelineStageError({ code: 'FOLDER_NOT_FOUND', stage: null, resource: folderId });
  }
  return folder;
}

export async function handleListFolders(
  deps: RenderApiDependencies,
  store: StoreConfig,
): Promise<HttpResponse> {
  return jsonResponse(200, await readOrganization(deps.storage, store.mediaRoot));
}

export async function handleCreateFolder(
  deps: RenderApiDependencies,
  store: StoreConfig,
  _params: RouteParams | undefined,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const name = await readNameFromBody(request);
  const current = await readOrganization(deps.storage, store.mediaRoot);
  const { organization, folder } = addFolder(current, name);
  await writeOrganization(deps.storage, store.mediaRoot, organization);

  return {
    status: 201,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/folders/${folder.id}` },
    body: folder,
  };
}

export async function handleRenameFolder(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const name = await readNameFromBody(request);
  const current = await readOrganization(deps.storage, store.mediaRoot);
  requireFolder(current, folderId);

  const organization = renameFolder(current, folderId, name);
  await writeOrganization(deps.storage, store.mediaRoot, organization);

  return jsonResponse(200, requireFolder(organization, folderId));
}

export async function handleDeleteFolder(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const current = await readOrganization(deps.storage, store.mediaRoot);
  requireFolder(current, folderId);

  const organization = removeFolder(current, folderId);
  await writeOrganization(deps.storage, store.mediaRoot, organization);

  return jsonResponse(200, organization);
}

export async function handleCreateCategory(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const name = await readNameFromBody(request);
  const current = await readOrganization(deps.storage, store.mediaRoot);
  const folder = requireFolder(current, folderId);

  const { organization, category } = addCategory(current, folder, name);
  await writeOrganization(deps.storage, store.mediaRoot, organization);

  return {
    status: 201,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/folders/${folderId}/categories/${category.id}` },
    body: category,
  };
}

export async function handleDeleteCategory(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const categoryId = params.categoryId ?? '';
  const current = await readOrganization(deps.storage, store.mediaRoot);
  const folder = requireFolder(current, folderId);

  if (findCategory(folder, categoryId) === null) {
    throw new PipelineStageError({
      code: 'FOLDER_CATEGORY_NOT_FOUND',
      stage: null,
      resource: `${folderId}/${categoryId}`,
    });
  }

  const organization = removeCategory(current, folderId, categoryId);
  await writeOrganization(deps.storage, store.mediaRoot, organization);

  return jsonResponse(200, organization);
}
