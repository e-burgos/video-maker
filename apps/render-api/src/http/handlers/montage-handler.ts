import {
  editDecisionListPath,
  resolveMediaProject,
  timelinePath,
  toAbsolutePath,
  writeEditDecisionList,
  writeTimeline,
} from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { EditDecisionListSchema, TimelineSchema } from '@video-maker/timeline-core';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import type { RenderApiErrorCode } from '../../errors/render-api-error';
import { isValidProjectSlug } from '../../store/project-slug';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
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

async function resolveExistingProject(
  deps: RenderApiDependencies,
  store: StoreConfig,
  slug: string,
): Promise<MediaProject> {
  const project = resolveMediaProject(join(store.mediaRoot, slug));
  const projectStat = await deps.storage.stat(project.root);
  if (projectStat === null || projectStat.kind !== 'directory') {
    throw new PipelineStageError({ code: 'PROJECT_NOT_FOUND', stage: null, resource: slug });
  }
  return project;
}

function parseJsonOrThrow(raw: string, invalidCode: RenderApiErrorCode, resource: string, expected: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new PipelineStageError({ code: invalidCode, stage: null, resource, expected });
  }
}

export async function handleGetTimeline(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const relativePath = timelinePath();
  const absolutePath = toAbsolutePath(project, relativePath);
  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null) {
    throw new PipelineStageError({ code: 'TIMELINE_NOT_FOUND', stage: null, resource: relativePath });
  }

  const raw = await deps.storage.readTextFile(absolutePath);
  const parsedJson = parseJsonOrThrow(
    raw,
    'TIMELINE_INVALID',
    relativePath,
    'a document accepted by TimelineSchema',
  );
  const result = TimelineSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'TIMELINE_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a document accepted by TimelineSchema',
    });
  }

  return jsonResponse(200, result.data);
}

export async function handleGetEditDecisionList(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const relativePath = editDecisionListPath();
  const absolutePath = toAbsolutePath(project, relativePath);
  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null) {
    throw new PipelineStageError({ code: 'EDL_NOT_FOUND', stage: null, resource: relativePath });
  }

  const raw = await deps.storage.readTextFile(absolutePath);
  const parsedJson = parseJsonOrThrow(
    raw,
    'EDL_INVALID',
    relativePath,
    'a document accepted by EditDecisionListSchema',
  );
  const result = EditDecisionListSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new PipelineStageError({
      code: 'EDL_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a document accepted by EditDecisionListSchema',
    });
  }

  return jsonResponse(200, result.data);
}

export async function handlePutTimeline(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const parsed = TimelineSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    throw new PipelineStageError({
      code: 'TIMELINE_INVALID',
      stage: null,
      resource: timelinePath(),
      expected: 'a document accepted by TimelineSchema',
    });
  }

  const project = await resolveExistingProject(deps, store, slug);
  const writtenPath = await writeTimeline(project, parsed.data, {
    writeTextFile: deps.storage.writeTextFile,
    ensureDirectory: deps.storage.ensureDirectory,
  });

  return jsonResponse(200, { slug, path: writtenPath });
}

export async function handlePutEditDecisionList(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_TOO_LARGE',
      stage: null,
      expected: `at most ${MAX_JSON_BODY_BYTES} bytes`,
    });
  }
  if (bodyResult.kind === 'invalid-json') {
    throw new PipelineStageError({
      code: 'REQUEST_BODY_INVALID_JSON',
      stage: null,
      expected: 'a JSON object',
    });
  }

  const parsed = EditDecisionListSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    throw new PipelineStageError({
      code: 'EDL_INVALID',
      stage: null,
      resource: editDecisionListPath(),
      expected: 'a document accepted by EditDecisionListSchema',
    });
  }

  const project = await resolveExistingProject(deps, store, slug);
  const writtenPath = await writeEditDecisionList(project, parsed.data, {
    writeTextFile: deps.storage.writeTextFile,
    ensureDirectory: deps.storage.ensureDirectory,
  });

  return jsonResponse(200, { slug, path: writtenPath });
}
