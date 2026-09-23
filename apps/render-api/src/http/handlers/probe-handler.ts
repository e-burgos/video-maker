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

const UNKNOWN_CODEC = 'unknown';

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function parseProbeMediaPath(value: unknown): string {
  const bodyObject = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const path = bodyObject.path;

  if (typeof path !== 'string' || path.trim().length === 0) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'path',
      expected: 'a non-empty project-relative path',
    });
  }

  return path;
}

export async function handleProbeMedia(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const path = parseProbeMediaPath(bodyResult.kind === 'parsed' ? bodyResult.value : {});

  const project = await resolveExistingProject(deps, store, slug);
  const resolved = await resolveProducerPath(deps.storage, project, path);

  const fileStat = await deps.storage.stat(resolved.absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: resolved.relativePath });
  }

  const asset = await deps
    .probeAsset({ path: resolved.absolutePath, assetId: resolved.relativePath })
    .catch((cause: unknown) => {
      throw translateEngineError(cause, null, resolved.relativePath);
    });

  const video =
    asset.kind === 'video'
      ? {
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          fps: asset.fps ?? 0,
          frames: asset.fps === undefined ? 0 : Math.round((asset.durationMs / 1000) * asset.fps),
          codec: asset.videoCodec ?? UNKNOWN_CODEC,
          hasAlpha: asset.hasAlpha ?? false,
        }
      : null;

  const audio =
    asset.audio === undefined
      ? null
      : {
          channels: asset.audio.channels,
          sampleRate: asset.audio.sampleRate,
          codec: asset.audio.codec ?? UNKNOWN_CODEC,
        };

  return jsonResponse(200, {
    path: resolved.relativePath,
    durationMs: asset.durationMs,
    video,
    audio,
  });
}
