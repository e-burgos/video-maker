import { dirname } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import {
  MAX_READABLE_PROJECT_TEXT_BYTES,
  assertReadableProjectText,
  assertWritableProjectText,
  resolveProducerPath,
} from '../../store/producer-writable-paths';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import { queryValue } from '../query-value';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

export async function handleGetProjectText(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const path = queryValue(request.path, 'path');
  if (path === null || path.trim().length === 0) {
    throw invalidInput('path', 'a non-empty project-relative path in the path query parameter');
  }

  const project = await resolveExistingProject(deps, store, slug);
  const resolved = await resolveProducerPath(deps.storage, project, path);
  assertReadableProjectText(resolved.relativePath);

  const fileStat = await deps.storage.stat(resolved.absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: resolved.relativePath });
  }

  if (fileStat.sizeBytes > MAX_READABLE_PROJECT_TEXT_BYTES) {
    throw new PipelineStageError({
      code: 'FILE_TOO_LARGE',
      stage: null,
      resource: resolved.relativePath,
      expected: `at most ${MAX_READABLE_PROJECT_TEXT_BYTES} bytes`,
    });
  }

  const content = await deps.storage.readTextFile(resolved.absolutePath);

  return jsonResponse(200, { path: resolved.relativePath, content });
}

interface PutProjectTextRequestBody {
  readonly path: string;
  readonly content: string;
}

function parsePutProjectTextBody(value: unknown): PutProjectTextRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const path = bodyObject.path;
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw invalidInput('path', 'a non-empty project-relative path');
  }

  const content = bodyObject.content;
  if (typeof content !== 'string') {
    throw invalidInput('content', 'a string');
  }

  return { path, content };
}

export async function handlePutProjectText(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { path, content } = parsePutProjectTextBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);
  const resolved = await resolveProducerPath(deps.storage, project, path);
  assertWritableProjectText(resolved.relativePath);

  await deps.storage.ensureDirectory(dirname(resolved.absolutePath));
  await deps.storage.writeTextFile(resolved.absolutePath, content);

  const bytes = new TextEncoder().encode(content).byteLength;

  return jsonResponse(200, { path: resolved.relativePath, bytes });
}
