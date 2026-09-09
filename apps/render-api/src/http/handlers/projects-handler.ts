import {
  catalogPath,
  editDecisionListPath,
  resolveMediaProject,
  timelinePath,
  toAbsolutePath,
} from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { ObjectStorage } from '../../deps/object-storage';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { isValidProjectSlug } from '../../store/project-slug';
import { layoutFlagsFrom } from '../../store/project-layout';
import type { ProjectLayoutFlags } from '../../store/project-layout';
import { countAssetsByRole, resolveProjectAssets } from '../../store/project-assets';
import type { AssetRole } from '../../store/asset-path';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

export interface ProjectSummary {
  readonly slug: string;
  readonly layout: ProjectLayoutFlags;
}

export interface ProjectDetail extends ProjectSummary {
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
  const [raw, catalog, timeline, edl, out] = await Promise.all([
    storage.stat(project.rawDir),
    storage.stat(toAbsolutePath(project, catalogPath())),
    storage.stat(toAbsolutePath(project, timelinePath())),
    storage.stat(toAbsolutePath(project, editDecisionListPath())),
    storage.stat(project.outDir),
  ]);
  return layoutFlagsFrom({ raw, catalog, timeline, edl, out });
}

async function buildProjectDetail(
  storage: ObjectStorage,
  project: MediaProject,
  slug: string,
): Promise<ProjectDetail> {
  const layout = await computeLayoutFlags(storage, project);
  const projectAssets = await resolveProjectAssets(storage, project);

  return {
    slug,
    layout,
    assetSource: projectAssets.source,
    assetCounts: countAssetsByRole(projectAssets.assets),
  };
}

export async function handleListProjects(
  deps: RenderApiDependencies,
  store: StoreConfig,
): Promise<HttpResponse> {
  const entries = await deps.storage.listDirectory(store.mediaRoot);
  const slugs = (entries ?? [])
    .filter((entry) => entry.isDirectory && isValidProjectSlug(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  const summaries: ProjectSummary[] = [];
  for (const slug of slugs) {
    const project = resolveMediaProject(join(store.mediaRoot, slug));
    summaries.push({ slug, layout: await computeLayoutFlags(deps.storage, project) });
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

  const project = resolveMediaProject(join(store.mediaRoot, slug));

  const existing = await deps.storage.stat(project.root);
  if (existing !== null) {
    throw new PipelineStageError({ code: 'PROJECT_ALREADY_EXISTS', stage: null, resource: slug });
  }

  const directoriesInOrder = [
    join(project.rawDir, 'aroll'),
    join(project.rawDir, 'broll'),
    join(project.rawDir, 'images'),
    join(project.rawDir, 'audio'),
    project.workDir,
    project.outDir,
  ];
  for (const directory of directoriesInOrder) {
    await deps.storage.ensureDirectory(directory);
  }

  const detail = await buildProjectDetail(deps.storage, project, slug);

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

  return jsonResponse(200, await buildProjectDetail(deps.storage, project, slug));
}
