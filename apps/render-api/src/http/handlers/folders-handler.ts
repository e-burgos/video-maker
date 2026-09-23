import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { findCategory, findFolder, normalizeName, toIdentifier } from '../../store/organization';
import type { Organization, VideoFolder } from '../../store/organization';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function uniqueIdentifier(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${String(suffix)}`)) {
    suffix += 1;
  }
  return `${base}-${String(suffix)}`;
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

export async function handleListFolders(deps: RenderApiDependencies): Promise<HttpResponse> {
  return jsonResponse(200, deps.localStore.organization.getOrganization());
}

export async function handleCreateFolder(
  deps: RenderApiDependencies,
  _params: RouteParams | undefined,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const name = await readNameFromBody(request);
  const current = deps.localStore.organization.getOrganization();
  const id = uniqueIdentifier(
    toIdentifier(name),
    new Set(current.folders.map((folder) => folder.id)),
  );

  deps.localStore.organization.createFolder(id, name);

  const folder: VideoFolder = { id, name, categories: [] };
  return {
    status: 201,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/folders/${id}` },
    body: folder,
  };
}

export async function handleRenameFolder(
  deps: RenderApiDependencies,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const name = await readNameFromBody(request);
  requireFolder(deps.localStore.organization.getOrganization(), folderId);

  deps.localStore.organization.renameFolder(folderId, name);

  return jsonResponse(200, requireFolder(deps.localStore.organization.getOrganization(), folderId));
}

export async function handleDeleteFolder(
  deps: RenderApiDependencies,
  params: RouteParams,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  requireFolder(deps.localStore.organization.getOrganization(), folderId);

  deps.localStore.organization.deleteFolder(folderId);

  return jsonResponse(200, deps.localStore.organization.getOrganization());
}

export async function handleCreateCategory(
  deps: RenderApiDependencies,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const name = await readNameFromBody(request);
  const current = deps.localStore.organization.getOrganization();
  requireFolder(current, folderId);
  const allCategoryIds = new Set(
    current.folders.flatMap((folder) => folder.categories.map((category) => category.id)),
  );
  const id = uniqueIdentifier(toIdentifier(name), allCategoryIds);

  deps.localStore.organization.createCategory(id, folderId, name);

  return {
    status: 201,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/folders/${folderId}/categories/${id}` },
    body: { id, name },
  };
}

export async function handleDeleteCategory(
  deps: RenderApiDependencies,
  params: RouteParams,
): Promise<HttpResponse> {
  const folderId = params.folderId ?? '';
  const categoryId = params.categoryId ?? '';
  const folder = requireFolder(deps.localStore.organization.getOrganization(), folderId);

  if (findCategory(folder, categoryId) === null) {
    throw new PipelineStageError({
      code: 'FOLDER_CATEGORY_NOT_FOUND',
      stage: null,
      resource: `${folderId}/${categoryId}`,
    });
  }

  deps.localStore.organization.deleteCategory(categoryId);

  return jsonResponse(200, deps.localStore.organization.getOrganization());
}
