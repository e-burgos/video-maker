import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { httpStatusFor } from '../errors/http-status-for';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { toErrorPayload } from '../errors/to-error-payload';
import { handleHealth } from './health-handler';
import { JSON_CONTENT_TYPE } from './http-message';
import type { HttpRequestLine, HttpResponse } from './http-message';
import { normalizePath, routeRequest } from './router';

export async function handleRequest(
  request: HttpRequestLine,
  deps: RenderApiDependencies,
): Promise<HttpResponse> {
  try {
    const match = routeRequest(request.method, normalizePath(request.path));

    if (match.kind === 'not-found') {
      throw new PipelineStageError({
        code: 'ROUTE_NOT_FOUND',
        stage: null,
        resource: normalizePath(request.path),
      });
    }

    if (match.kind === 'method-not-allowed') {
      throw new PipelineStageError({
        code: 'METHOD_NOT_ALLOWED',
        stage: null,
        resource: normalizePath(request.path),
        expected: match.allow.join(', '),
      });
    }

    return await handleHealth(deps);
  } catch (cause) {
    return toErrorResponse(cause, deps);
  }
}

export function toErrorResponse(cause: unknown, deps: RenderApiDependencies): HttpResponse {
  const error = toErrorPayload(cause);
  deps.logger.error({ event: 'request-failed', detail: { code: error.code } });

  return {
    status: httpStatusFor(error.code),
    headers:
      error.code === 'METHOD_NOT_ALLOWED' && error.expected !== undefined
        ? { 'content-type': JSON_CONTENT_TYPE, allow: error.expected }
        : { 'content-type': JSON_CONTENT_TYPE },
    body: { error },
  };
}
