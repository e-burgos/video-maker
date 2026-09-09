import { describe, expect, it, vi } from 'vitest';

import { createRenderApiClient } from './render-api-client';
import { RenderApiError } from './render-api-error';
import type { FetchLike } from './render-api-client';

type Call = { url: string; init: RequestInit | undefined };

function recordingFetch(response: () => Response | Promise<Response>): {
  fetchImpl: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return response();
  };
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const health = {
  status: 'ok',
  service: 'render-api',
  cycle: 3,
  time: '2026-09-09T00:00:00.000Z',
  engine: [{ name: 'media-local', loaded: true }],
  binaries: [{ name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true }],
  capabilities: { renderPipeline: true, assetStore: true, jobQueue: true },
  jobs: { running: 0, queued: 0 },
};

describe('createRenderApiClient', () => {
  it('reads the service health from EP-001', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(health));

    const result = await createRenderApiClient(fetchImpl).getHealth();

    expect(calls[0]?.url).toBe('/api/health');
    expect(calls[0]?.init).toBeUndefined();
    expect(result.status).toBe('ok');
    expect(result.capabilities.assetStore).toBe(true);
  });

  it('lists projects from EP-002', async () => {
    const projects = [{ slug: 'smoke-ingest', layout: { raw: true, catalog: true, timeline: true, edl: true, out: true } }];
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(projects));

    const result = await createRenderApiClient(fetchImpl).listProjects();

    expect(calls[0]?.url).toBe('/api/projects');
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('smoke-ingest');
  });

  it('creates a project with a JSON body on EP-003', async () => {
    const detail = {
      slug: 'demo',
      layout: { raw: true, catalog: false, timeline: false, edl: false, out: true },
      assetSource: 'raw-scan',
      assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0 },
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(detail, 201));

    const result = await createRenderApiClient(fetchImpl).createProject('demo');

    expect(calls[0]?.url).toBe('/api/projects');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(calls[0]?.init?.body).toBe('{"slug":"demo"}');
    expect(result.assetCounts.aroll).toBe(0);
  });

  it('reads a project detail from EP-004 with an encoded slug', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({
        slug: 'a b',
        layout: { raw: true, catalog: false, timeline: false, edl: false, out: false },
        assetSource: 'raw-scan',
        assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0 },
      }),
    );

    await createRenderApiClient(fetchImpl).getProject('a b');

    expect(calls[0]?.url).toBe('/api/projects/a%20b');
  });

  it('lists assets from EP-005', async () => {
    const listing = { slug: 'smoke-ingest', source: 'catalog', assets: [], probeFailures: [] };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(listing));

    const result = await createRenderApiClient(fetchImpl).listAssets('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/assets');
    expect(result.source).toBe('catalog');
  });

  it('uploads a raw binary body on EP-006 with the asset content type', async () => {
    const entry = {
      path: 'raw/aroll/clip01.mp4',
      role: 'aroll',
      fingerprint: { sizeBytes: 12, modifiedAtMs: 1 },
      media: null,
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(entry, 201));
    const body = new Blob(['0123456789ab'], { type: 'video/mp4' });

    const result = await createRenderApiClient(fetchImpl).uploadAsset({
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip 01.mp4',
      contentType: 'video/mp4',
      body,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/assets/aroll/clip%2001.mp4');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'video/mp4' });
    expect(calls[0]?.init?.body).toBe(body);
    expect(result.path).toBe('raw/aroll/clip01.mp4');
  });

  it('turns a typed service error into a RenderApiError that keeps the code', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'PROJECT_NOT_FOUND', stage: null, message: 'No such project.' } },
        404,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .listAssets('ghost')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RenderApiError);
    expect((error as RenderApiError).code).toBe('PROJECT_NOT_FOUND');
    expect((error as RenderApiError).status).toBe(404);
  });

  it('reports RESPONSE_NOT_JSON when an error status carries no typed payload', async () => {
    const { fetchImpl } = recordingFetch(() => new Response('<html>502</html>', { status: 502 }));

    const error = await createRenderApiClient(fetchImpl)
      .getHealth()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_NOT_JSON');
  });

  it('reports RESPONSE_SHAPE_UNEXPECTED when a 200 does not match the contract', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ nope: true }));

    const error = await createRenderApiClient(fetchImpl)
      .listProjects()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
    expect((error as RenderApiError).message).toContain('a project array');
  });

  it('reports SERVICE_UNREACHABLE when fetch itself rejects', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await createRenderApiClient(fetchImpl)
      .getHealth()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('SERVICE_UNREACHABLE');
  });

  it('rejects a health body that is not a health document', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse([]));

    const error = await createRenderApiClient(fetchImpl)
      .getHealth()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('rejects a project detail and an asset listing that do not match the contract', async () => {
    const client = createRenderApiClient(recordingFetch(() => jsonResponse({ nope: true })).fetchImpl);

    await expect(client.getProject('demo')).rejects.toMatchObject({
      code: 'RESPONSE_SHAPE_UNEXPECTED',
    });
    await expect(client.listAssets('demo')).rejects.toMatchObject({
      code: 'RESPONSE_SHAPE_UNEXPECTED',
    });
    await expect(client.createProject('demo')).rejects.toMatchObject({
      code: 'RESPONSE_SHAPE_UNEXPECTED',
    });
    await expect(
      client.uploadAsset({
        slug: 'demo',
        role: 'audio',
        filename: 'a.mp3',
        contentType: 'audio/mpeg',
        body: new Blob(['x']),
      }),
    ).rejects.toMatchObject({ code: 'RESPONSE_SHAPE_UNEXPECTED' });
  });
});
