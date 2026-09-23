import { toAbsolutePath } from '@video-maker/auto-montage';
import { dirname } from 'node:path/posix';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import { resolveProducerPath } from '../../store/producer-writable-paths';
import { isAssetRole, isPortableFileName, rawDirectoryForRole } from '../../store/asset-path';
import type { AssetRole } from '../../store/asset-path';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

interface CopyAssetRequestBody {
  readonly from: string;
  readonly role: AssetRole;
  readonly filename: string;
}

function parseCopyAssetBody(value: unknown): CopyAssetRequestBody {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const from = bodyObject.from;
  if (typeof from !== 'string' || from.trim().length === 0) {
    throw invalidInput('from', 'a non-empty project-relative path');
  }

  const role = bodyObject.role;
  if (typeof role !== 'string' || !isAssetRole(role)) {
    throw invalidInput('role', 'aroll, broll, image, audio, voice or logo');
  }

  const filename = bodyObject.filename;
  if (typeof filename !== 'string' || !isPortableFileName(filename)) {
    throw invalidInput('filename', 'a single portable path segment');
  }

  return { from, role, filename };
}

export async function handleCopyAsset(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const { from, role, filename } = parseCopyAssetBody(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);
  const source = await resolveProducerPath(deps.storage, project, from);

  const sourceStat = await deps.storage.stat(source.absolutePath);
  if (sourceStat === null || sourceStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: source.relativePath });
  }

  const targetRelativePath = `raw/${rawDirectoryForRole(role)}/${filename}`;
  const targetAbsolutePath = toAbsolutePath(project, targetRelativePath);

  return runtime.uploadSerializer.run(slug, async () => {
    const targetStat = await deps.storage.stat(targetAbsolutePath);
    if (targetStat !== null) {
      throw new PipelineStageError({ code: 'ASSET_EXISTS', stage: null, resource: targetRelativePath });
    }

    await deps.storage.ensureDirectory(dirname(targetAbsolutePath));
    await deps.storage.copyFile(source.absolutePath, targetAbsolutePath);

    return {
      status: 201,
      headers: { 'content-type': JSON_CONTENT_TYPE, location: `/projects/${slug}/files/${targetRelativePath}` },
      body: { path: targetRelativePath },
    };
  });
}
