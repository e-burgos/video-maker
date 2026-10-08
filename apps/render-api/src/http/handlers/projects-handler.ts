import {
  catalogPath,
  editDecisionListPath,
  resolveMediaProject,
  timelinePath,
  toAbsolutePath,
} from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { PROJECT_MODES } from '@video-maker/local-store';
import type { ProjectMode } from '@video-maker/local-store';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { ObjectStorage } from '../../deps/object-storage';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { assertBrandExists, brandExists } from '../../store/project-brand';
import { isValidProjectSlug } from '../../store/project-slug';
import { findCategory, findFolder, placementOf } from '../../store/organization';
import type { Organization, VideoPlacement } from '../../store/organization';
import { directoryHasAnyFile, layoutFlagsFrom } from '../../store/project-layout';
import type { ProjectLayoutFlags } from '../../store/project-layout';
import { countAssetsByRole, resolveProjectAssets } from '../../store/project-assets';
import type { AssetRole } from '../../store/asset-path';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

export interface ProjectSummary {
  readonly slug: string;
  readonly mode: ProjectMode;
  readonly brand: string | null;
  readonly layout: ProjectLayoutFlags;
}

export interface ProjectDetail extends ProjectSummary {
  readonly brandMissing: boolean;
  readonly assetSource: 'catalog' | 'raw-scan';
  readonly assetCounts: Readonly<Record<AssetRole, number>>;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function extractSlugFromBody(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as { slug?: unknown }).slug;
  return typeof candidate === 'string' ? candidate : null;
}

function extractModeFromBody(value: unknown): ProjectMode {
  const candidate = (value as { mode?: unknown }).mode;
  if (candidate === undefined) {
    return 'footage';
  }
  if (typeof candidate !== 'string' || !(PROJECT_MODES as readonly string[]).includes(candidate)) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      resource: 'mode',
      expected: PROJECT_MODES.join(' or '),
    });
  }
  return candidate as ProjectMode;
}

function extractBrandFromBody(value: unknown): string | null {
  const candidate = (value as { brand?: unknown }).brand;
  if (candidate === undefined || candidate === null) {
    return null;
  }
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      resource: 'brand',
      expected: 'a brand id string or null',
    });
  }
  return candidate;
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

async function computeLayoutFlags(storage: ObjectStorage, project: MediaProject): Promise<ProjectLayoutFlags> {
  const [rawHasFiles, catalog, timeline, edl, outHasFiles] = await Promise.all([
    directoryHasAnyFile(storage, project.rawDir),
    storage.stat(toAbsolutePath(project, catalogPath())),
    storage.stat(toAbsolutePath(project, timelinePath())),
    storage.stat(toAbsolutePath(project, editDecisionListPath())),
    directoryHasAnyFile(storage, project.outDir),
  ]);
  return layoutFlagsFrom({ rawHasFiles, catalog, timeline, edl, outHasFiles });
}

async function buildProjectDetail(
  storage: ObjectStorage,
  project: MediaProject,
  slug: string,
  mode: ProjectMode,
  brand: string | null,
  brandMissing: boolean,
): Promise<ProjectDetail> {
  const layout = await computeLayoutFlags(storage, project);
  const projectAssets = await resolveProjectAssets(storage, project);

  return {
    slug,
    mode,
    brand,
    brandMissing,
    layout,
    assetSource: projectAssets.source,
    assetCounts: countAssetsByRole(projectAssets.assets),
  };
}

export async function handleListProjects(
  deps: RenderApiDependencies,
  store: StoreConfig,
): Promise<HttpResponse> {
  const summaries: ProjectSummary[] = [];

  for (const record of deps.localStore.projects.list()) {
    const project = resolveMediaProject(join(store.mediaRoot, record.slug));
    const projectStat = await deps.storage.stat(project.root);
    if (projectStat === null || projectStat.kind !== 'directory') {
      continue;
    }
    summaries.push({
      slug: record.slug,
      mode: record.mode,
      brand: record.brand,
      layout: await computeLayoutFlags(deps.storage, project),
    });
  }

  return jsonResponse(200, summaries);
}

export async function handleCreateProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  _params: RouteParams | undefined,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);

  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json' || bodyResult.kind === 'empty') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const slug = extractSlugFromBody(bodyResult.value);
  if (slug === null) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  assertValidProjectSlug(slug);
  const mode = extractModeFromBody(bodyResult.value);
  const brand = extractBrandFromBody(bodyResult.value);
  if (brand !== null) {
    await assertBrandExists(deps, store, brand);
  }

  const project = resolveMediaProject(join(store.mediaRoot, slug));

  const existing = await deps.storage.stat(project.root);
  if (existing !== null) {
    throw new PipelineStageError({ code: 'PROJECT_ALREADY_EXISTS', stage: null, resource: slug });
  }

  deps.localStore.projects.insert(slug, null, mode, brand);

  const directoriesInOrder = [
    join(project.rawDir, 'aroll'),
    join(project.rawDir, 'broll'),
    join(project.rawDir, 'images'),
    join(project.rawDir, 'audio'),
    join(project.rawDir, 'voice'),
    join(project.rawDir, 'logo'),
    project.workDir,
    project.outDir,
    ...(mode === 'motion' ? [join(project.root, 'motion')] : []),
  ];
  for (const directory of directoriesInOrder) {
    await deps.storage.ensureDirectory(directory);
  }

  const detail = await buildProjectDetail(deps.storage, project, slug, mode, brand, false);

  return {
    status: 201,
    headers: { 'content-type': JSON_CONTENT_TYPE, location: `/projects/${slug}` },
    body: detail,
  };
}

export async function handleGetProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const existing = await deps.storage.stat(project.root);
  if (existing === null || existing.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }

  return jsonResponse(200, await describeStoredProject(deps, store, project, slug));
}

async function describeStoredProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  project: MediaProject,
  slug: string,
): Promise<ProjectDetail> {
  const record = deps.localStore.projects.get(slug);
  const brand = record?.brand ?? null;
  const brandMissing = brand !== null && !(await brandExists(deps, store, brand));
  return buildProjectDetail(deps.storage, project, slug, record?.mode ?? 'footage', brand, brandMissing);
}

export async function handlePutProjectBrand(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  await assertProjectDirectoryExists(deps, project, slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind !== 'parsed' || typeof bodyResult.value !== 'object' || bodyResult.value === null || Array.isArray(bodyResult.value)) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const brand = extractBrandFromBody(bodyResult.value);
  if (brand !== null) {
    await assertBrandExists(deps, store, brand);
  }

  if (!deps.localStore.projects.exists(slug)) {
    deps.localStore.projects.insert(slug, deps.clock.nowIso());
  }
  deps.localStore.projects.setBrand(slug, brand);

  return jsonResponse(200, await describeStoredProject(deps, store, project, slug));
}

function extractPlacementFromBody(value: unknown): {
  folderId: string | null;
  categoryId: string | null;
  archived: boolean | null;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const { folderId, categoryId, archived } = value as {
    folderId?: unknown;
    categoryId?: unknown;
    archived?: unknown;
  };

  const readOptionalId = (candidate: unknown, field: string): string | null => {
    if (candidate === undefined || candidate === null) {
      return null;
    }
    if (typeof candidate !== 'string') {
      throw new PipelineStageError({
        code: 'VIDEO_PLACEMENT_INVALID',
        stage: null,
        resource: field,
        expected: 'a string identifier or null',
      });
    }
    return candidate;
  };

  if (archived !== undefined && typeof archived !== 'boolean') {
    throw new PipelineStageError({
      code: 'VIDEO_PLACEMENT_INVALID',
      stage: null,
      resource: 'archived',
      expected: 'a boolean',
    });
  }

  return {
    folderId: readOptionalId(folderId, 'folderId'),
    categoryId: readOptionalId(categoryId, 'categoryId'),
    archived: archived === undefined ? null : archived,
  };
}

function assertPlacementExists(
  organization: Organization,
  folderId: string | null,
  categoryId: string | null,
): void {
  if (folderId === null) {
    if (categoryId !== null) {
      throw new PipelineStageError({
        code: 'VIDEO_PLACEMENT_INVALID',
        stage: null,
        resource: categoryId,
        expected: 'no category when the video belongs to no folder',
      });
    }
    return;
  }

  const folder = findFolder(organization, folderId);
  if (folder === null) {
    throw new PipelineStageError({ code: 'FOLDER_NOT_FOUND', stage: null, resource: folderId });
  }
  if (categoryId !== null && findCategory(folder, categoryId) === null) {
    throw new PipelineStageError({
      code: 'FOLDER_CATEGORY_NOT_FOUND',
      stage: null,
      resource: `${folderId}/${categoryId}`,
    });
  }
}

async function assertProjectDirectoryExists(
  deps: RenderApiDependencies,
  project: MediaProject,
  slug: string,
): Promise<void> {
  const existing = await deps.storage.stat(project.root);
  if (existing === null || existing.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }
}

export async function handlePutProjectPlacement(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  await assertProjectDirectoryExists(deps, project, slug);

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

  const requested = extractPlacementFromBody(bodyResult.value);
  const current = deps.localStore.organization.getOrganization();
  assertPlacementExists(current, requested.folderId, requested.categoryId);

  const placement: VideoPlacement = {
    folderId: requested.folderId,
    categoryId: requested.categoryId,
    archived: requested.archived ?? placementOf(current, slug).archived,
  };
  deps.localStore.organization.setPlacement(slug, placement);

  return jsonResponse(200, { slug, placement });
}

export async function handleDeleteProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const project = resolveMediaProject(join(store.mediaRoot, slug));
  await assertProjectDirectoryExists(deps, project, slug);

  await deps.storage.removeDirectory(project.root);
  deps.localStore.projects.delete(slug);

  return jsonResponse(200, { slug, deleted: true });
}
