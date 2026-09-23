import { toAbsolutePath } from '@video-maker/auto-montage';
import {
  MAX_EXTRACT_FRAMES_AT_SECONDS,
  MIN_EXTRACT_FRAMES_AT_SECONDS,
} from '@video-maker/producer-tools';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { translateEngineError } from '../../errors/translate-engine-error';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { resolveProducerPath } from '../../store/producer-writable-paths';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

const FRAMES_DIRECTORY = 'work/producer/frames';
const FRAME_MAX_LONG_SIDE_PX = 768;

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

interface ExtractFramesRequestBody {
  readonly path: string;
  readonly atSeconds: readonly number[];
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function parseExtractFramesBody(value: unknown): ExtractFramesRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const path = bodyObject.path;
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw invalidInput('path', 'a non-empty project-relative path');
  }

  const atSeconds = bodyObject.atSeconds;
  const isValidAtSeconds =
    Array.isArray(atSeconds) &&
    atSeconds.length >= MIN_EXTRACT_FRAMES_AT_SECONDS &&
    atSeconds.length <= MAX_EXTRACT_FRAMES_AT_SECONDS &&
    atSeconds.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0);

  if (!isValidAtSeconds) {
    throw invalidInput(
      'atSeconds',
      `an array of ${MIN_EXTRACT_FRAMES_AT_SECONDS} to ${MAX_EXTRACT_FRAMES_AT_SECONDS} non-negative numbers`,
    );
  }

  return { path, atSeconds: atSeconds as readonly number[] };
}

function frameFileName(atSeconds: number): string {
  return `t${Math.round(atSeconds * 1000)}.jpg`;
}

export async function handleExtractFrames(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { path, atSeconds } = parseExtractFramesBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);
  const resolved = await resolveProducerPath(deps.storage, project, path);

  const fileStat = await deps.storage.stat(resolved.absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: resolved.relativePath });
  }

  await deps.storage.ensureDirectory(toAbsolutePath(project, FRAMES_DIRECTORY));

  const frames: { readonly atSeconds: number; readonly path: string }[] = [];
  for (const atSecond of atSeconds) {
    const relativeOutPath = `${FRAMES_DIRECTORY}/${frameFileName(atSecond)}`;
    const absoluteOutPath = toAbsolutePath(project, relativeOutPath);

    await deps
      .extractFrame({
        path: resolved.absolutePath,
        atSeconds: atSecond,
        outPath: absoluteOutPath,
        maxLongSidePx: FRAME_MAX_LONG_SIDE_PX,
        projectRoot: project.root,
      })
      .catch((cause: unknown) => {
        throw translateEngineError(cause, null, resolved.relativePath);
      });

    frames.push({ atSeconds: atSecond, path: relativeOutPath });
  }

  return jsonResponse(200, { frames });
}
