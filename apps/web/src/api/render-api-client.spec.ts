import { describe, expect, it, vi } from 'vitest';

import { RAW_PREVIEW_TIMELINE, previewTimelineFixture } from './__fixtures__/timeline';
import { createRenderApiClient } from './render-api-client';
import { RenderApiError } from './render-api-error';
import type { FetchLike } from './render-api-client';
import type { RenderJob } from './render-api-types';

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

function jobWithState(state: RenderJob['state']): RenderJob {
  return {
    id: 'job-0001',
    slug: 'smoke-ingest',
    state,
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: '2026-09-09T10:00:01.000Z',
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
  };
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

  it('reads the persisted timeline from EP-007 with the slug encoded', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(RAW_PREVIEW_TIMELINE));

    const result = await createRenderApiClient(fetchImpl).getTimeline('smoke ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke%20ingest/timeline');
    expect(calls[0]?.init).toBeUndefined();
    expect(result).toEqual(previewTimelineFixture());
  });

  it('rejects a body that is not a timeline document as RESPONSE_SHAPE_UNEXPECTED', async () => {
    const client = createRenderApiClient(
      recordingFetch(() => jsonResponse({ schemaVersion: 2, tracks: {} })).fetchImpl,
    );

    await expect(client.getTimeline('demo')).rejects.toMatchObject({
      code: 'RESPONSE_SHAPE_UNEXPECTED',
    });
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

  it('writes the full timeline document in a single PUT on EP-008', async () => {
    const timeline = previewTimelineFixture();
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ slug: 'smoke-ingest', path: 'work/timeline.json' }),
    );

    const result = await createRenderApiClient(fetchImpl).putTimeline('smoke-ingest', timeline);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/timeline');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });

    const sentBody = JSON.parse(calls[0]?.init?.body as string) as Record<string, unknown>;
    expect(Object.keys(sentBody).sort()).toEqual(Object.keys(timeline).sort());
    expect(result).toEqual({ slug: 'smoke-ingest', path: 'work/timeline.json' });
  });

  it('rejects a putTimeline result that does not match the write-result contract', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ nope: true }));

    const error = await createRenderApiClient(fetchImpl)
      .putTimeline('demo', previewTimelineFixture())
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('maps TIMELINE_INVALID from EP-008 without touching the request shape', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'TIMELINE_INVALID', stage: null, message: 'bad timeline' } }, 422),
    );

    const error = await createRenderApiClient(fetchImpl)
      .putTimeline('demo', previewTimelineFixture())
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('TIMELINE_INVALID');
    expect((error as RenderApiError).status).toBe(422);
  });

  it('creates a render job with no body and no content-type on EP-012', async () => {
    const job = jobWithState('queued');
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(job, 202));

    const result = await createRenderApiClient(fetchImpl).createRenderJob('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/jobs');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toBeUndefined();
    expect(calls[0]?.init?.body).toBeUndefined();
    expect(result.state).toBe('queued');
  });

  it('maps TIMELINE_NOT_FOUND from EP-012 with its code', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'TIMELINE_NOT_FOUND', stage: null, message: 'no timeline' } }, 404),
    );

    const error = await createRenderApiClient(fetchImpl)
      .createRenderJob('demo')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('TIMELINE_NOT_FOUND');
  });

  it('lists render jobs from EP-013 as summaries only, never the full report or error', async () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0001',
          state: 'succeeded',
          stage: null,
          errorCode: null,
          createdAt: '2026-09-09T10:00:00.000Z',
          startedAt: '2026-09-09T10:00:01.000Z',
          finishedAt: '2026-09-09T10:01:00.000Z',
        },
      ],
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(listing));

    const result = await createRenderApiClient(fetchImpl).listRenderJobs('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/jobs');
    expect(calls[0]?.init).toBeUndefined();
    expect(Object.keys(result.jobs[0] as object).sort()).toEqual([
      'createdAt',
      'errorCode',
      'finishedAt',
      'id',
      'stage',
      'startedAt',
      'state',
    ]);
  });

  it('accepts an empty jobs array from EP-013 as a valid listing, not an error', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ slug: 'ghost', jobs: [] }));

    const result = await createRenderApiClient(fetchImpl).listRenderJobs('ghost');

    expect(result).toEqual({ slug: 'ghost', jobs: [] });
  });

  it('reads a single render job from EP-014, including a 200 for state: failed', async () => {
    const failed = { ...jobWithState('failed'), error: { code: 'INVALID_TIMELINE', stage: 'render', message: 'x' } };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(failed));

    const result = await createRenderApiClient(fetchImpl).getRenderJob('job-0001');

    expect(calls[0]?.url).toBe('/api/jobs/job-0001');
    expect(result.state).toBe('failed');
    expect(result.error?.code).toBe('INVALID_TIMELINE');
  });

  it('maps RENDER_JOB_NOT_FOUND from EP-014 with its code', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'RENDER_JOB_NOT_FOUND', stage: null, message: 'gone' } }, 404),
    );

    const error = await createRenderApiClient(fetchImpl)
      .getRenderJob('ghost-job')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RENDER_JOB_NOT_FOUND');
  });

  it('maps cancellation outcomes from EP-015: 200 canceled, 202 canceling, idempotent 202, and 409', async () => {
    const canceledFetch = recordingFetch(() => jsonResponse(jobWithState('canceled'), 200));
    const canceled = await createRenderApiClient(canceledFetch.fetchImpl).cancelRenderJob('job-0001');
    expect(canceled).toEqual({ status: 200, job: jobWithState('canceled') });

    const cancelingFetch = recordingFetch(() => jsonResponse(jobWithState('canceling'), 202));
    const cancelingClient = createRenderApiClient(cancelingFetch.fetchImpl);

    const firstCanceling = await cancelingClient.cancelRenderJob('job-0001');
    expect(firstCanceling).toEqual({ status: 202, job: jobWithState('canceling') });
    expect(cancelingFetch.calls[0]?.url).toBe('/api/jobs/job-0001');
    expect(cancelingFetch.calls[0]?.init?.method).toBe('DELETE');

    const secondCanceling = await cancelingClient.cancelRenderJob('job-0001');
    expect(secondCanceling.status).toBe(202);
    expect(secondCanceling.job.state).toBe('canceling');
    expect(cancelingFetch.calls).toHaveLength(2);

    const conflictFetch = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'RENDER_JOB_NOT_CANCELABLE', stage: null, message: 'already terminal' } },
        409,
      ),
    );
    const conflictError = await createRenderApiClient(conflictFetch.fetchImpl)
      .cancelRenderJob('job-0001')
      .catch((caught: unknown) => caught);
    expect((conflictError as RenderApiError).code).toBe('RENDER_JOB_NOT_CANCELABLE');
    expect((conflictError as RenderApiError).status).toBe(409);
  });

  it('rejects a cancellation body that is not even a record as RESPONSE_SHAPE_UNEXPECTED', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse('not a record', 202));

    const error = await createRenderApiClient(fetchImpl)
      .cancelRenderJob('job-0001')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });
});
