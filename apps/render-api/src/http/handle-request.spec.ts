import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../__fixtures__/http-request';
import type { StoreConfig } from '../config/store-config';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { handleRequest } from './handle-request';
import { JSON_CONTENT_TYPE } from './http-message';
import { createRenderApiRuntime } from './render-api-runtime';
import { ROUTES } from './routes';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

function canonicalPathFor(pattern: string): string {
  return pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith('*')) {
        return 'a/b/c';
      }
      if (segment.startsWith(':')) {
        return 'example';
      }
      return segment;
    })
    .join('/');
}

async function* emptyJsonBody(): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode('{}');
}

describe('handleRequest', () => {
  it('answers 404 with a JSON ROUTE_NOT_FOUND envelope for an unknown path', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/unknown-path' }, deps, STORE, runtime);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        stage: null,
        message: 'No route matches the requested path.',
        resource: '/unknown-path',
      },
    });
  });

  it('answers 405 with a JSON METHOD_NOT_ALLOWED envelope and an Allow header', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'POST', path: '/health' }, deps, STORE, runtime);

    expect(response.status).toBe(405);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(response.headers.allow).toBe('GET');
    expect(response.body).toEqual({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        stage: null,
        message: 'The requested method is not allowed on this path.',
        resource: '/health',
        expected: 'GET',
      },
    });
  });

  it('answers JSON with the mapped status when a handler throws a RenderApiError', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      preloadEngineModules: async () => {
        throw new PipelineStageError({ code: 'MEDIA_BINARY_NOT_FOUND', stage: 'mix', resource: 'ffmpeg' });
      },
    });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/health' }, deps, STORE, runtime);

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(response.body).toEqual({
      error: {
        code: 'MEDIA_BINARY_NOT_FOUND',
        stage: 'mix',
        message: 'A required media binary could not be resolved.',
        resource: 'ffmpeg',
      },
    });
  });

  it('answers 500 for a value outside the RenderApiError hierarchy thrown by a handler', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      preloadEngineModules: async () => {
        throw new Error('unexpected crash');
      },
    });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/health' }, deps, STORE, runtime);

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        stage: null,
        message: 'The service failed for an unexpected reason.',
      },
    });
  });

  it('dispatches every RouteId to its handler', async () => {
    for (const route of ROUTES) {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog);
      const runtime = createRenderApiRuntime(deps);
      const path = canonicalPathFor(route.pattern);
      const request = requestLine({ method: route.method, path, body: emptyJsonBody() });

      const response = await handleRequest(request, deps, STORE, runtime);
      const body = response.body as { error?: { code?: string } };

      expect(body.error?.code).not.toBe('ROUTE_NOT_FOUND');
    }
  });
});
