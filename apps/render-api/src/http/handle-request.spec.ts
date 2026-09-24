import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../__fixtures__/http-request';
import type { ServerConfig } from '../config/server-config';
import type { StoreConfig } from '../config/store-config';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { handleRequest } from './handle-request';
import { JSON_CONTENT_TYPE } from './http-message';
import { createRenderApiRuntime } from './render-api-runtime';
import { ROUTES } from './routes';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const CONFIG: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };

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

    const response = await handleRequest({ method: 'GET', path: '/unknown-path' }, deps, STORE, runtime, CONFIG);

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

    const response = await handleRequest({ method: 'POST', path: '/health' }, deps, STORE, runtime, CONFIG);

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

    const response = await handleRequest({ method: 'GET', path: '/health' }, deps, STORE, runtime, CONFIG);

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

    const response = await handleRequest({ method: 'GET', path: '/health' }, deps, STORE, runtime, CONFIG);

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

      const response = await handleRequest(request, deps, STORE, runtime, CONFIG);
      const body = response.body as { error?: { code?: string } };

      expect(body.error?.code).not.toBe('ROUTE_NOT_FOUND');
    }
  });
});

describe('handleRequest static serving and /api prefix (D-C3-03)', () => {
  let webRoot: string;

  afterEach(async () => {
    if (webRoot !== undefined) {
      await rm(webRoot, { recursive: true, force: true });
    }
  });

  async function createWebRoot(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'render-api-web-root-'));
    await writeFile(join(dir, 'index.html'), '<html>studio</html>');
    return dir;
  }

  it('with RENDER_API_WEB_ROOT set, GET /api/health strips the prefix and reaches the API', async () => {
    webRoot = await createWebRoot();
    const config: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot, accessToken: null };
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/api/health' }, deps, STORE, runtime, config);

    expect(response.status).toBe(200);
    expect((response.body as { service: string }).service).toBe('render-api');
  });

  it('with RENDER_API_WEB_ROOT set, GET /health (unprefixed) still reaches the API directly', async () => {
    webRoot = await createWebRoot();
    const config: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot, accessToken: null };
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/health' }, deps, STORE, runtime, config);

    expect(response.status).toBe(200);
    expect((response.body as { service: string }).service).toBe('render-api');
  });

  it('with RENDER_API_WEB_ROOT set, a path that matches no API route falls back to static (SPA)', async () => {
    webRoot = await createWebRoot();
    const config: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot, accessToken: null };
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      { method: 'GET', path: '/projects/acme-launch' },
      deps,
      STORE,
      runtime,
      config,
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('without RENDER_API_WEB_ROOT, /api/health is not stripped and answers ROUTE_NOT_FOUND', async () => {
    const config: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: null };
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest({ method: 'GET', path: '/api/health' }, deps, STORE, runtime, config);

    expect(response.status).toBe(404);
  });
});

describe('handleRequest local access guard (D-C3-04)', () => {
  const TOKEN = 'b'.repeat(64);
  const CONFIG_WITH_TOKEN: ServerConfig = { host: '127.0.0.1', port: 4310, webRoot: null, accessToken: TOKEN };

  it('denies a request with no token, cookie or header', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      requestLine({ method: 'GET', path: '/health', headers: { host: '127.0.0.1:4310' } }),
      deps,
      STORE,
      runtime,
      CONFIG_WITH_TOKEN,
    );

    expect(response.status).toBe(403);
    expect((response.body as { error: { code: string } }).error.code).toBe('ACCESS_DENIED');
  });

  it('denies a request whose Host header is not 127.0.0.1:<port> or localhost:<port>', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      requestLine({
        method: 'GET',
        path: '/health',
        headers: { host: 'evil.example:4310', 'x-studio-token': TOKEN },
      }),
      deps,
      STORE,
      runtime,
      CONFIG_WITH_TOKEN,
    );

    expect(response.status).toBe(403);
  });

  it('GET /?t=<token> sets the session cookie and 302s to /', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      requestLine({ method: 'GET', path: `/?t=${TOKEN}`, headers: { host: '127.0.0.1:4310' } }),
      deps,
      STORE,
      runtime,
      CONFIG_WITH_TOKEN,
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/');
    expect(response.headers['set-cookie']).toBe(`vm_session=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`);
  });

  it('a request with the right x-studio-token header reaches the API (MCP/producer path)', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      requestLine({
        method: 'GET',
        path: '/health',
        headers: { host: '127.0.0.1:4310', 'x-studio-token': TOKEN },
      }),
      deps,
      STORE,
      runtime,
      CONFIG_WITH_TOKEN,
    );

    expect(response.status).toBe(200);
  });

  it('a request with the right vm_session cookie reaches the API (browser path)', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const response = await handleRequest(
      requestLine({
        method: 'GET',
        path: '/health',
        headers: { host: '127.0.0.1:4310', cookie: `vm_session=${TOKEN}` },
      }),
      deps,
      STORE,
      runtime,
      CONFIG_WITH_TOKEN,
    );

    expect(response.status).toBe(200);
  });
});
