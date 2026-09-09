import { resolveMediaProject, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { toErrorPayload } from '../../errors/to-error-payload';
import { isPortableArtifactPath } from '../../store/asset-path';
import { isValidProjectSlug } from '../../store/project-slug';
import { parseByteRange } from '../byte-range';
import { contentTypeFor } from '../content-type-for';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import type { RouteParams } from '../router';

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

export async function handleGetArtifact(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const artifactPath = params.path ?? '';
  if (!isPortableArtifactPath(artifactPath)) {
    throw new PipelineStageError({
      code: 'ASSET_PATH_INVALID',
      stage: null,
      resource: artifactPath,
      expected: 'a project-relative path under raw/, work/ or out/',
    });
  }

  const project = await resolveExistingProject(deps, store, slug);

  const absolutePath = toAbsolutePath(project, artifactPath);
  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'ARTIFACT_NOT_FOUND', stage: null, resource: artifactPath });
  }

  const rangeResult = parseByteRange(request.headers.range, fileStat.sizeBytes);
  const contentType = contentTypeFor(artifactPath);

  if (rangeResult.kind === 'unsatisfiable') {
    const error = new PipelineStageError({
      code: 'RANGE_NOT_SATISFIABLE',
      stage: null,
      resource: artifactPath,
      expected: `bytes */${fileStat.sizeBytes}`,
    });
    return {
      status: 416,
      headers: {
        'content-type': JSON_CONTENT_TYPE,
        'content-range': `bytes */${fileStat.sizeBytes}`,
      },
      body: { error: toErrorPayload(error) },
    };
  }

  if (rangeResult.kind === 'satisfiable') {
    return {
      status: 206,
      headers: {
        'content-type': contentType,
        'content-range': `bytes ${rangeResult.start}-${rangeResult.end}/${fileStat.sizeBytes}`,
        'content-length': String(rangeResult.end - rangeResult.start + 1),
        'accept-ranges': 'bytes',
      },
      body: undefined,
      stream: () => deps.storage.openReadStream(absolutePath, { start: rangeResult.start, end: rangeResult.end }),
    };
  }

  return {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(fileStat.sizeBytes),
      'accept-ranges': 'bytes',
    },
    body: undefined,
    stream: () => deps.storage.openReadStream(absolutePath),
  };
}
