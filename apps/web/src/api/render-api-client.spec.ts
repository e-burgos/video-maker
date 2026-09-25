import { describe, expect, it, vi } from 'vitest';

import { RAW_PREVIEW_TIMELINE, previewTimelineFixture } from './__fixtures__/timeline';
import { RAW_STORYBOARD, storyboardFixture } from './__fixtures__/storyboard';
import {
  producerConversation,
  producerSettings,
  producerTurn,
  succeededTurn,
} from './__fixtures__/producer';
import { VOICE_MODELS, voiceDocument, voiceJob, voiceTrack } from './__fixtures__/voice';
import { createRenderApiClient } from './render-api-client';
import { RenderApiError } from './render-api-error';
import type { FetchLike } from './render-api-client';
import type { MontageJob, RenderJob, StoryboardJob } from './render-api-types';

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
    kind: 'render',
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

function montageJob(): MontageJob {
  return {
    id: 'job-0002',
    kind: 'montage',
    slug: 'smoke-ingest',
    state: 'running',
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: '2026-09-09T10:00:01.000Z',
    finishedAt: null,
    progress: { stage: 'transcribe', processedAssets: 2, totalAssets: 6, percent: 33.3 },
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
  capabilities: { renderPipeline: true, assetStore: true, jobQueue: true, montageQueue: true, storyboardQueue: true, voiceQueue: true, producer: true },
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

  it('deletes one asset through EP-027 with every path segment encoded', async () => {
    const deletion = {
      slug: 'smoke-ingest',
      deleted: {
        path: 'raw/aroll/clip 01.mp4',
        role: 'aroll',
        catalogEntryRemoved: true,
        removedArtifacts: ['work/transcripts/aroll/clip 01.json'],
      },
      timelineReferences: [],
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(deletion));

    const result = await createRenderApiClient(fetchImpl).deleteAsset({
      slug: 'smoke ingest',
      role: 'aroll',
      filename: 'clip 01.mp4',
      force: false,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke%20ingest/assets/aroll/clip%2001.mp4');
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(calls[0]?.init?.headers).toBeUndefined();
    expect(result).toEqual(deletion);
  });

  it('uploads a raw binary body to the inbox on EP-042 with the filename encoded', async () => {
    const asset = {
      id: 'inbox-0001',
      fileName: 'clip 01.mp4',
      path: 'raw/inbox/clip 01.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: { kind: 'video', durationMs: 4000, hasAudio: true },
      status: 'pending',
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ asset }, 201));
    const body = new Blob(['0123456789ab'], { type: 'video/mp4' });

    const result = await createRenderApiClient(fetchImpl).uploadToInbox({
      slug: 'smoke-ingest',
      filename: 'clip 01.mp4',
      contentType: 'video/mp4',
      body,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/inbox/clip%2001.mp4');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'video/mp4' });
    expect(calls[0]?.init?.body).toBe(body);
    expect(result).toEqual(asset);
  });

  it('lists the pending inbox assets from EP-043', async () => {
    const listing = { assets: [] };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(listing));

    const result = await createRenderApiClient(fetchImpl).listInbox('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/inbox');
    expect(result).toEqual(listing);
  });

  it('confirms an inbox asset role through EP-044 with a JSON body', async () => {
    const asset = {
      id: 'inbox-0001',
      fileName: 'clip01.mp4',
      path: 'raw/broll/clip01.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      confirmedRole: 'broll',
      probe: { kind: 'video', durationMs: 4000, hasAudio: true },
      status: 'confirmed',
    };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ asset }));

    const result = await createRenderApiClient(fetchImpl).confirmInboxAsset(
      'smoke-ingest',
      'inbox-0001',
      'broll',
    );

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/inbox/inbox-0001/confirm');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(calls[0]?.init?.body).toBe('{"role":"broll"}');
    expect(result).toEqual(asset);
  });

  it('discards a pending inbox asset through EP-045', async () => {
    const deletion = { slug: 'smoke-ingest', deleted: { id: 'inbox-0001', path: 'raw/inbox/clip01.mp4' } };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(deletion));

    const result = await createRenderApiClient(fetchImpl).discardInboxAsset('smoke-ingest', 'inbox-0001');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/inbox/inbox-0001');
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(result).toEqual(deletion);
  });

  it('asks EP-027 to delete an asset the timeline uses with force=true', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({
        slug: 'smoke-ingest',
        deleted: {
          path: 'raw/aroll/clip01.mp4',
          role: 'aroll',
          catalogEntryRemoved: true,
          removedArtifacts: [],
        },
        timelineReferences: [{ kind: 'asset' }, { kind: 'clip', track: 'aroll', clipId: 'c1' }],
      }),
    );

    const result = await createRenderApiClient(fetchImpl).deleteAsset({
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip01.mp4',
      force: true,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/assets/aroll/clip01.mp4?force=true');
    expect(result.timelineReferences).toHaveLength(2);
  });

  it('raises the typed ASSET_IN_USE of EP-027 with its list of uses', async () => {
    const client = createRenderApiClient(
      recordingFetch(() =>
        jsonResponse(
          {
            error: {
              code: 'ASSET_IN_USE',
              stage: null,
              message: 'The stored timeline still references this asset.',
              resource: 'raw/aroll/clip01.mp4',
              hint: 'asset, tracks.aroll clip clip-aroll-1',
            },
          },
          409,
        ),
      ).fetchImpl,
    );

    await expect(
      client.deleteAsset({ slug: 'demo', role: 'aroll', filename: 'clip01.mp4', force: false }),
    ).rejects.toMatchObject({
      code: 'ASSET_IN_USE',
      status: 409,
      payload: { hint: 'asset, tracks.aroll clip clip-aroll-1' },
    });
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

  it('creates a montage job on EP-012 with the kind discriminant and its three parameters', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(montageJob(), 202));

    const result = await createRenderApiClient(fetchImpl).createMontageJob('smoke-ingest', {
      preset: 'software-demo',
      seed: 7,
      overwrite: false,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/jobs');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      kind: 'montage',
      preset: 'software-demo',
      seed: 7,
      overwrite: false,
    });
    expect(result.kind).toBe('montage');
  });

  it('sends overwrite: true when the caller confirms the regeneration', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(montageJob(), 202));

    await createRenderApiClient(fetchImpl).createMontageJob('smoke-ingest', {
      preset: 'educational',
      seed: 0,
      overwrite: true,
    });

    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ overwrite: true });
  });

  it('maps TIMELINE_ALREADY_EXISTS from EP-012 with its code and 409 status', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        {
          error: {
            code: 'TIMELINE_ALREADY_EXISTS',
            stage: null,
            message: 'The project already has a timeline.',
          },
        },
        409,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .createMontageJob('smoke-ingest', { preset: 'software-demo', seed: 0, overwrite: false })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('TIMELINE_ALREADY_EXISTS');
    expect((error as RenderApiError).status).toBe(409);
  });

  it('refuses a render job document where a montage job was requested', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse(jobWithState('queued'), 202));

    const error = await createRenderApiClient(fetchImpl)
      .createMontageJob('smoke-ingest', { preset: 'software-demo', seed: 0, overwrite: false })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('reads a montage job from EP-014 through the same job endpoint as a render job', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(montageJob()));

    const result = await createRenderApiClient(fetchImpl).getRenderJob('job-0002');

    expect(calls[0]?.url).toBe('/api/jobs/job-0002');
    expect(result.kind).toBe('montage');
    expect(result.progress).toEqual({
      stage: 'transcribe',
      processedAssets: 2,
      totalAssets: 6,
      percent: 33.3,
    });
  });

  it('lists render jobs from EP-013 as summaries only, never the full report or error', async () => {
    const listing = {
      slug: 'smoke-ingest',
      jobs: [
        {
          id: 'job-0001',
          kind: 'render',
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
      'kind',
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

  it('retries a job via EP-036, posting to /jobs/:jobId/retry and parsing the new job', async () => {
    const retried = { ...jobWithState('queued'), id: 'job-0002' };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(retried, 202));

    const result = await createRenderApiClient(fetchImpl).retryJob('job-0001');

    expect(calls[0]?.url).toBe('/api/jobs/job-0001/retry');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(result).toEqual(retried);
  });

  it('maps RENDER_JOB_NOT_FOUND from EP-036 for an id no store knows', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'RENDER_JOB_NOT_FOUND', stage: null, message: 'gone' } }, 404),
    );

    const error = await createRenderApiClient(fetchImpl)
      .retryJob('ghost-job')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RENDER_JOB_NOT_FOUND');
  });

  it('maps JOB_NOT_RETRYABLE from EP-036 for a job that is not failed or canceled', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'JOB_NOT_RETRYABLE', stage: null, message: 'not retryable' } }, 409),
    );

    const error = await createRenderApiClient(fetchImpl)
      .retryJob('job-0001')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('JOB_NOT_RETRYABLE');
  });

  it('maps JOB_RECORD_INVALID from EP-036 for a persisted row that cannot be reconstructed', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'JOB_RECORD_INVALID', stage: null, message: 'invalid record' } }, 422),
    );

    const error = await createRenderApiClient(fetchImpl)
      .retryJob('job-0001')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('JOB_RECORD_INVALID');
  });
});

function storyboardJob(): StoryboardJob {
  return {
    id: 'job-0009',
    kind: 'storyboard',
    slug: 'smoke-ingest',
    state: 'running',
    createdAt: '2026-09-09T12:00:00.000Z',
    startedAt: '2026-09-09T12:00:00.500Z',
    finishedAt: null,
    progress: { stage: 'propose', percent: 66 },
    report: null,
    error: null,
  };
}

function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

describe('createRenderApiClient · storyboard', () => {
  it('creates a storyboard job from a brief with exactly the contract keys of EP-012', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(storyboardJob(), 202));

    const job = await createRenderApiClient(fetchImpl).createStoryboardJob('smoke-ingest', {
      brief: 'Tres trucos de terminal',
      overwrite: false,
    });

    expect(job.kind).toBe('storyboard');
    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/jobs');
    expect(calls[0]?.init?.method).toBe('POST');
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['brief', 'kind', 'overwrite']);
    expect(body['kind']).toBe('storyboard');
  });

  it('sends scriptText instead of brief when the user pasted a script, never both', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(storyboardJob(), 202));

    await createRenderApiClient(fetchImpl).createStoryboardJob('smoke-ingest', {
      scriptText: 'Escena 1. Nina mira a cámara.',
      overwrite: true,
    });

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['kind', 'overwrite', 'scriptText']);
    expect(body['overwrite']).toBe(true);
  });

  it('maps STORYBOARD_ALREADY_EXISTS from EP-012 with its code and 409 status', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        {
          error: {
            code: 'STORYBOARD_ALREADY_EXISTS',
            stage: null,
            message: 'the project already has a storyboard',
          },
        },
        409,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .createStoryboardJob('smoke-ingest', { brief: 'idea', overwrite: false })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('STORYBOARD_ALREADY_EXISTS');
    expect((error as RenderApiError).status).toBe(409);
  });

  it('keeps each typed agent failure code the job creation can answer', async () => {
    for (const [status, code] of [
      [503, 'AI_AGENT_UNAVAILABLE'],
      [429, 'AI_AGENT_RATE_LIMITED'],
      [502, 'AI_AGENT_FAILED'],
      [502, 'AI_AGENT_INVALID_OUTPUT'],
      [422, 'STORYBOARD_INPUT_INVALID'],
    ] as const) {
      const { fetchImpl } = recordingFetch(() =>
        jsonResponse({ error: { code, stage: null, message: code } }, status),
      );

      const error = await createRenderApiClient(fetchImpl)
        .createStoryboardJob('smoke-ingest', { brief: 'idea', overwrite: false })
        .catch((caught: unknown) => caught);

      expect((error as RenderApiError).code).toBe(code);
      expect((error as RenderApiError).status).toBe(status);
    }
  });

  it('refuses a montage job document where a storyboard job was requested', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse(montageJob(), 202));

    const error = await createRenderApiClient(fetchImpl)
      .createStoryboardJob('smoke-ingest', { brief: 'idea', overwrite: false })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('reads the storyboard document from EP-016 with the same shallow shape check as the timeline', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(RAW_STORYBOARD));

    const document = await createRenderApiClient(fetchImpl).getStoryboard('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/storyboard');
    expect(calls[0]?.init).toBeUndefined();
    expect(document.scenes).toHaveLength(3);
  });

  it('rejects a 200 that is not a storyboard document at all, before any page sees it', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ schemaVersion: 1 }));

    const error = await createRenderApiClient(fetchImpl)
      .getStoryboard('smoke-ingest')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('maps STORYBOARD_NOT_FOUND from EP-016 with its code', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'STORYBOARD_NOT_FOUND', stage: null, message: 'no storyboard yet' } },
        404,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .getStoryboard('smoke-ingest')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('STORYBOARD_NOT_FOUND');
  });

  it('writes the full storyboard document in a single PUT on EP-017', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ slug: 'smoke-ingest', path: 'work/storyboard.json' }),
    );

    const result = await createRenderApiClient(fetchImpl).putStoryboard(
      'smoke-ingest',
      storyboardFixture(),
    );

    expect(result).toEqual({ slug: 'smoke-ingest', path: 'work/storyboard.json' });
    expect(calls[0]?.init?.method).toBe('PUT');
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'captionsStyle',
      'characters',
      'createdAt',
      'format',
      'id',
      'language',
      'musicTags',
      'scenes',
      'schemaVersion',
      'source',
      'title',
    ]);
  });

  it('maps STORYBOARD_INVALID from EP-017 without touching the request shape', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'STORYBOARD_INVALID', stage: null, message: 'does not validate' } },
        422,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .putStoryboard('smoke-ingest', storyboardFixture())
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('STORYBOARD_INVALID');
  });

  it('reads the prompt sheet of EP-018 as plain text, exactly as the service emitted it', async () => {
    const sheet = '# CHARACTERS\n\n01. Nina — mustard hoodie\n\n# SCENES\n\n01. upload — a prompt\n';
    const { fetchImpl, calls } = recordingFetch(() => textResponse(sheet));

    const text = await createRenderApiClient(fetchImpl).getStoryboardPrompts('smoke-ingest');

    expect(text).toBe(sheet);
    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/storyboard/prompts');
  });

  it('still reads the typed JSON error of EP-018 even though the success body is text', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'STORYBOARD_NOT_FOUND', stage: null, message: 'nothing to export' } },
        404,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .getStoryboardPrompts('smoke-ingest')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('STORYBOARD_NOT_FOUND');
  });
});

describe('createRenderApiClient · voice', () => {
  it('lists the installed voices from EP-019', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(VOICE_MODELS));

    const listing = await createRenderApiClient(fetchImpl).listVoices();

    expect(calls[0]?.url).toBe('/api/voices');
    expect(calls[0]?.init).toBeUndefined();
    expect(listing.voices.find((voice) => voice.isDefault)?.id).toBe('es_AR-daniela-high');
  });

  it('surfaces VOICE_MODEL_UNAVAILABLE from EP-019 instead of an empty list', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'VOICE_MODEL_UNAVAILABLE', stage: null, message: 'voice engine not configured' } },
        503,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .listVoices()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('VOICE_MODEL_UNAVAILABLE');
  });

  it('reads the manifest and its staleness view from EP-020', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(voiceDocument()));

    const document = await createRenderApiClient(fetchImpl).getVoice('smoke-ingest');

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/voice');
    expect(document.scenes.map((scene) => scene.stale)).toEqual([false, true]);
  });

  it('surfaces VOICE_NOT_FOUND from EP-020 so the page can show its empty state', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'VOICE_NOT_FOUND', stage: null, message: 'no manifest yet' } },
        404,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .getVoice('smoke-ingest')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('VOICE_NOT_FOUND');
  });

  it('creates a whole voice-over with only the fields EP-012 reads for this kind', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(voiceJob(), 202));

    await createRenderApiClient(fetchImpl).createVoiceJob('smoke-ingest', {
      voiceId: 'es_AR-daniela-high',
      sceneIds: null,
      overwrite: false,
    });

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/jobs');
    expect(calls[0]?.init?.method).toBe('POST');
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(Object.keys(body).sort()).toEqual(['kind', 'overwrite', 'voice']);
    expect(body).toEqual({ kind: 'voice', overwrite: false, voice: 'es_AR-daniela-high' });
  });

  it('regenerates a single scene by sending sceneIds and overwrite', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(voiceJob(), 202));

    await createRenderApiClient(fetchImpl).createVoiceJob('smoke-ingest', {
      voiceId: null,
      sceneIds: ['scene-02'],
      overwrite: true,
    });

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(Object.keys(body).sort()).toEqual(['kind', 'overwrite', 'sceneIds']);
    expect(body).toEqual({ kind: 'voice', overwrite: true, sceneIds: ['scene-02'] });
  });

  it('refuses a job document of another kind coming back from the voice request', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse(montageJob(), 202));

    const error = await createRenderApiClient(fetchImpl)
      .createVoiceJob('smoke-ingest', { voiceId: null, sceneIds: null, overwrite: false })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('attaches a recorded take to one scene with EP-021', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({
        slug: 'smoke-ingest',
        path: 'work/voice/manifest.json',
        track: voiceTrack({ source: 'uploaded', voiceId: null }),
      }),
    );

    const written = await createRenderApiClient(fetchImpl).attachVoiceTake(
      'smoke-ingest',
      'scene 03',
      'take-03.wav',
    );

    expect(calls[0]?.url).toBe('/api/projects/smoke-ingest/voice/scenes/scene%2003');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ fileName: 'take-03.wav' });
    expect(written.track.source).toBe('uploaded');
    expect(written.track.voiceId).toBeNull();
  });

  it('surfaces VOICE_ASSET_NOT_FOUND from EP-021 with its code intact', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'VOICE_ASSET_NOT_FOUND', stage: null, message: 'not under raw/voice/' } },
        404,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .attachVoiceTake('smoke-ingest', 'scene-03', 'missing.wav')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('VOICE_ASSET_NOT_FOUND');
  });
});

describe('createRenderApiClient — producer', () => {
  it('reads the whole conversation from EP-022', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(producerConversation()));

    const conversation = await createRenderApiClient(fetchImpl).getProducer('demo-01');

    expect(calls[0]?.url).toBe('/api/projects/demo-01/producer');
    expect(calls[0]?.init).toBeUndefined();
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.session?.model).toBe('sonnet');
  });

  it('sends a message as JSON and returns the accepted turn of EP-023', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse(
        { slug: 'demo-01', turnId: 'turn-0002', startedAt: '2026-09-10T10:10:00.000Z', status: 'running' },
        202,
      ),
    );

    const accepted = await createRenderApiClient(fetchImpl).sendProducerMessage(
      'demo-01',
      'Proponeme un video de 30 segundos',
    );

    expect(calls[0]?.url).toBe('/api/projects/demo-01/producer/messages');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      text: 'Proponeme un video de 30 segundos',
    });
    expect(accepted.turnId).toBe('turn-0002');
  });

  it('manda a EP-023 el modelo elegido, y lo omite cuando el llamador no eligió ninguno', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse(
        { slug: 'demo-01', turnId: 'turn-0002', startedAt: '2026-09-10T10:00:00.000Z', status: 'running' },
        202,
      ),
    );
    const client = createRenderApiClient(fetchImpl);

    await client.sendProducerMessage('demo-01', 'dale', 'haiku');
    await client.sendProducerMessage('demo-01', 'dale');

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ text: 'dale', model: 'haiku' });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ text: 'dale' });
  });

  it('surfaces PRODUCER_TURN_ACTIVE from EP-023 with its code intact', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        {
          error: {
            code: 'PRODUCER_TURN_ACTIVE',
            stage: null,
            message: 'a turn is running',
            resource: 'turn-0001',
          },
        },
        409,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .sendProducerMessage('demo-01', 'otra cosa')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('PRODUCER_TURN_ACTIVE');
    expect((error as RenderApiError).payload?.resource).toBe('turn-0001');
  });

  it('reads one turn from EP-024 with its events and suggestions', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(succeededTurn()));

    const turn = await createRenderApiClient(fetchImpl).getProducerTurn('demo-01', 'turn 1');

    expect(calls[0]?.url).toBe('/api/projects/demo-01/producer/turns/turn%201');
    expect(turn.suggestions).toHaveLength(2);
    expect(turn.events.filter((event) => event.type === 'tool')).toHaveLength(2);
  });

  it('cancels a turn with DELETE on EP-025 and returns the record it answers', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(producerTurn(), 202));

    const turn = await createRenderApiClient(fetchImpl).cancelProducerTurn('demo-01', 'turn-0001');

    expect(calls[0]?.url).toBe('/api/projects/demo-01/producer/turns/turn-0001');
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(turn.status).toBe('running');
  });

  it('surfaces PRODUCER_TURN_NOT_CANCELABLE from EP-025', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'PRODUCER_TURN_NOT_CANCELABLE', stage: null, message: 'already finished' } },
        409,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .cancelProducerTurn('demo-01', 'turn-0001')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('PRODUCER_TURN_NOT_CANCELABLE');
  });
});

describe('createRenderApiClient — producer settings', () => {
  it('reads the engine and model configuration from EP-037', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(producerSettings()));

    const settings = await createRenderApiClient(fetchImpl).getProducerSettings();

    expect(calls[0]?.url).toBe('/api/settings/producer');
    expect(calls[0]?.init).toBeUndefined();
    expect(settings.effectiveEngine).toBe('claude-cli');
  });

  it('writes the engine and default models as JSON to EP-038', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse(producerSettings({ engine: 'openrouter' })),
    );

    const settings = await createRenderApiClient(fetchImpl).updateProducerSettings({
      engine: 'openrouter',
      models: { openrouter: 'openai/gpt-4o-mini' },
    });

    expect(calls[0]?.url).toBe('/api/settings/producer');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      engine: 'openrouter',
      models: { openrouter: 'openai/gpt-4o-mini' },
    });
    expect(settings.engine).toBe('openrouter');
  });

  it('surfaces PRODUCER_MODEL_INVALID from EP-038', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'PRODUCER_MODEL_INVALID', stage: null, message: 'not curated', resource: 'models.openrouter' } },
        422,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .updateProducerSettings({ models: { openrouter: 'not-a-real-model' } })
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('PRODUCER_MODEL_INVALID');
  });

  it('sends the key to EP-039 and never keeps it beyond the request body', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ keyPresent: true, keyHint: 'wxyz' }),
    );

    const result = await createRenderApiClient(fetchImpl).putOpenRouterKey(
      'sk-or-v1-abcdefghijklmnop',
    );

    expect(calls[0]?.url).toBe('/api/settings/producer/openrouter-key');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      apiKey: 'sk-or-v1-abcdefghijklmnop',
    });
    expect(result).toEqual({ keyPresent: true, keyHint: 'wxyz' });
  });

  it('surfaces OPENROUTER_KEY_INVALID from EP-039', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'OPENROUTER_KEY_INVALID', stage: null, message: 'rejected' } },
        422,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .putOpenRouterKey('sk-or-v1-abcdefghijklmnop')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('OPENROUTER_KEY_INVALID');
  });

  it('deletes the key with DELETE on EP-040', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ keyPresent: false, keyHint: null }),
    );

    const result = await createRenderApiClient(fetchImpl).deleteOpenRouterKey();

    expect(calls[0]?.url).toBe('/api/settings/producer/openrouter-key');
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(result).toEqual({ keyPresent: false, keyHint: null });
  });

  it('surfaces SECRET_STORE_UNAVAILABLE from EP-040', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { error: { code: 'SECRET_STORE_UNAVAILABLE', stage: null, message: 'keychain failed' } },
        503,
      ),
    );

    const error = await createRenderApiClient(fetchImpl)
      .deleteOpenRouterKey()
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('SECRET_STORE_UNAVAILABLE');
  });
});

describe('createRenderApiClient — listGenerated y getProjectFile (FIX-006-001, FIX-009-003)', () => {
  const LISTING = {
    slug: 'display-ads',
    roots: ['work/voice', 'work/producer', 'out'],
    files: [{ path: 'out/display-ads.mp4', sizeBytes: 10, modifiedAtMs: 1 }],
  };

  it('pide el listado de lo generado a EP-028', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(LISTING));

    const listing = await createRenderApiClient(fetchImpl).listGenerated('display-ads');

    expect(calls[0]?.url).toBe('/api/projects/display-ads/generated');
    expect(listing.files).toHaveLength(1);
  });

  it('rechaza un cuerpo que no tiene la forma del listado', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ slug: 'display-ads', files: 'many' }));

    const error = await createRenderApiClient(fetchImpl)
      .listGenerated('display-ads')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  });

  it('propaga el error tipado del servicio', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'PROJECT_NOT_FOUND', stage: null, message: 'gone' } }, 404),
    );

    const error = await createRenderApiClient(fetchImpl)
      .listGenerated('display-ads')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('PROJECT_NOT_FOUND');
  });

  it('lee un archivo del proyecto por EP-011, con cada segmento escapado', async () => {
    const { fetchImpl, calls } = recordingFetch(
      () => new Response('[0:00] Hola', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    const text = await createRenderApiClient(fetchImpl).getProjectFile(
      'display ads',
      'work/producer/script.txt',
    );

    expect(text).toBe('[0:00] Hola');
    expect(calls[0]?.url).toBe('/api/projects/display%20ads/files/work/producer/script.txt');
  });

  it('nunca deja que un path escape del proyecto', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response('x', { status: 200 }));

    await createRenderApiClient(fetchImpl).getProjectFile('demo', '../../etc/passwd');

    expect(calls[0]?.url).toBe('/api/projects/demo/files/etc/passwd');
  });

  it('lee el error tipado cuando el archivo no está', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ error: { code: 'ARTIFACT_NOT_FOUND', stage: null, message: 'no file' } }, 404),
    );

    const error = await createRenderApiClient(fetchImpl)
      .getProjectFile('demo', 'work/voice/script-manifest.json')
      .catch((caught: unknown) => caught);

    expect((error as RenderApiError).code).toBe('ARTIFACT_NOT_FOUND');
  });

  it('manda scriptPath en el job de voz sólo cuando se lo pide', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(voiceJob(), 202));
    const client = createRenderApiClient(fetchImpl);

    await client.createVoiceJob('demo', { voiceId: null, sceneIds: null, overwrite: false });
    await client.createVoiceJob('demo', {
      voiceId: 'es_AR-daniela-high',
      sceneIds: null,
      overwrite: true,
      scriptPath: 'work/producer/script.txt',
    });

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ kind: 'voice', overwrite: false });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      kind: 'voice',
      overwrite: true,
      voice: 'es_AR-daniela-high',
      scriptPath: 'work/producer/script.txt',
    });
  });
});
