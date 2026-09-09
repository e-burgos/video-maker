import { afterEach, describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import type { StoreConfig } from '../config/store-config';
import { createRenderApiServer } from './create-render-api-server';
import type { RenderApiServer } from './create-render-api-server';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

describe('createRenderApiServer', () => {
  let server: RenderApiServer | undefined;

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
      server = undefined;
    }
  });

  it('serves GET /health over a real loopback socket on an ephemeral port and closes', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    server = createRenderApiServer(deps, { host: '127.0.0.1', port: 0 }, STORE);

    const address = await server.listen();
    expect(address.host).toBe('127.0.0.1');
    expect(address.port).toBeGreaterThan(0);

    const response = await fetch(`http://${address.host}:${address.port}/health`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((body as { status: string }).status).toBe('ok');

    await server.close();
    server = undefined;

    await expect(fetch(`http://${address.host}:${address.port}/health`)).rejects.toThrow();
  });

  it('falls back to its own last-resort 500 when handleRequest itself throws', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      logger: {
        info: () => undefined,
        error: () => {
          throw new Error('logger is broken');
        },
      },
    });
    server = createRenderApiServer(deps, { host: '127.0.0.1', port: 0 }, STORE);

    const address = await server.listen();
    const response = await fetch(`http://${address.host}:${address.port}/unknown-path`);
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect((body as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
  });

  it('rejects a second close call because the server is no longer running', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    server = createRenderApiServer(deps, { host: '127.0.0.1', port: 0 }, STORE);

    await server.listen();
    await server.close();

    await expect(server.close()).rejects.toThrow();
    server = undefined;
  });

  it('streams a byte response over a real loopback socket honouring a Range request', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/raw/aroll/clip01.mp4`, contents: 'hello world' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    server = createRenderApiServer(deps, { host: '127.0.0.1', port: 0 }, STORE);

    const address = await server.listen();
    const response = await fetch(
      `http://${address.host}:${address.port}/projects/smoke-ingest/files/raw/aroll/clip01.mp4`,
      { headers: { range: 'bytes=0-4' } },
    );
    const text = await response.text();

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-4/11');
    expect(text).toBe('hello');
  });

  it('creates a job and reads it back over a real loopback socket', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    server = createRenderApiServer(deps, { host: '127.0.0.1', port: 0 }, STORE);

    const address = await server.listen();

    const createResponse = await fetch(`http://${address.host}:${address.port}/projects/smoke-ingest/jobs`, {
      method: 'POST',
    });
    const createdJob = (await createResponse.json()) as { id: string; slug: string; state: string };

    expect(createResponse.status).toBe(202);
    expect(createResponse.headers.get('location')).toBe(`/jobs/${createdJob.id}`);
    expect(createdJob.slug).toBe('smoke-ingest');

    let job: { id: string; state: string } = createdJob;
    for (let attempt = 0; attempt < 20 && job.state !== 'succeeded'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const getResponse = await fetch(`http://${address.host}:${address.port}/jobs/${createdJob.id}`);
      job = (await getResponse.json()) as { id: string; state: string };
    }

    expect(job.id).toBe(createdJob.id);
    expect(job.state).toBe('succeeded');
  });
});
