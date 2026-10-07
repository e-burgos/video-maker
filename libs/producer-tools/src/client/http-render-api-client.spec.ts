import { describe, expect, it } from 'vitest';

import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createHttpRenderApiClient, STUDIO_TOKEN_HEADER } from './http-render-api-client';

interface FakeFetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function createFakeFetch(
  handler: (call: FakeFetchCall, index: number) => Response | Promise<Response>,
): { readonly fetchImpl: typeof fetch; readonly calls: FakeFetchCall[] } {
  const calls: FakeFetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const call: FakeFetchCall = { url, init };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function errorResponse(status: number, code: string, hint?: string): Response {
  return jsonResponse(status, { error: { code, stage: null, message: code, ...(hint === undefined ? {} : { hint }) } });
}

function client(fetchImpl: typeof fetch) {
  return createHttpRenderApiClient({ apiUrl: 'http://127.0.0.1:4599', slug: 'pitch-deck', fetchImpl });
}

describe('createHttpRenderApiClient', () => {
  it('getProjectDetail returns the parsed project detail', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse(200, { slug: 'pitch-deck', layout: { timeline: true }, assetSource: 'catalog', assetCounts: {} }),
    );

    const detail = await client(fetchImpl).getProjectDetail();

    expect(detail.slug).toBe('pitch-deck');
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/projects/pitch-deck');
  });

  it('listProjectAssets returns the assets array', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(200, { assets: [{ path: 'raw/aroll/a.mp4', role: 'aroll', media: { durationMs: 1000 } }] }),
    );

    const assets = await client(fetchImpl).listProjectAssets();

    expect(assets).toEqual([{ path: 'raw/aroll/a.mp4', role: 'aroll', media: { durationMs: 1000 } }]);
  });

  it('listRecentJobs sorts by createdAt descending and slices to the limit', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(200, {
        jobs: [
          { id: 'a', kind: 'render', state: 'succeeded', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'b', kind: 'render', state: 'succeeded', createdAt: '2026-01-03T00:00:00.000Z' },
          { id: 'c', kind: 'render', state: 'succeeded', createdAt: '2026-01-02T00:00:00.000Z' },
        ],
      }),
    );

    const jobs = await client(fetchImpl).listRecentJobs(2);

    expect(jobs.map((job) => job.id)).toEqual(['b', 'c']);
  });

  it('readProducerScriptState returns none when the script does not exist', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(404, 'FILE_NOT_FOUND'));

    expect(await client(fetchImpl).readProducerScriptState()).toBe('none');
  });

  it('readProducerScriptState returns plain for a script without time marks', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(200, { path: 'work/producer/script.txt', content: 'Hello there.\nSecond line.' }),
    );

    expect(await client(fetchImpl).readProducerScriptState()).toBe('plain');
  });

  it('readProducerScriptState returns timed when a line starts with a time mark', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(200, { path: 'work/producer/script.txt', content: '[0:05] Hello there.' }),
    );

    expect(await client(fetchImpl).readProducerScriptState()).toBe('timed');
  });

  it('probeMedia passes the path through and returns the response as-is', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse(200, { path: 'raw/aroll/a.mp4', durationMs: 1000, video: null, audio: null }),
    );

    const result = await client(fetchImpl).probeMedia('raw/aroll/a.mp4');

    expect(result.durationMs).toBe(1000);
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ path: 'raw/aroll/a.mp4' });
  });

  it('extractFrames returns the frames array', async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse(200, { frames: [{ atSeconds: 1, path: 'a.jpg' }] }));

    const frames = await client(fetchImpl).extractFrames('raw/aroll/a.mp4', [1]);

    expect(frames).toEqual([{ atSeconds: 1, path: 'a.jpg' }]);
  });

  it('readFileBytes returns the raw bytes and the content-type header', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { fetchImpl, calls } = createFakeFetch(() => new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }));

    const file = await client(fetchImpl).readFileBytes('work/producer/frames/t1000.jpg');

    expect([...file.bytes]).toEqual([1, 2, 3]);
    expect(file.mimeType).toBe('image/jpeg');
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/projects/pitch-deck/files/work/producer/frames/t1000.jpg');
  });

  it('readFileBytes maps a 404 into FILE_NOT_FOUND without touching the body as JSON', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(404, 'FILE_NOT_FOUND'));

    await expect(client(fetchImpl).readFileBytes('raw/aroll/missing.mp4')).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });

  it('readProjectText / writeProjectText / copyAsset round-trip their bodies', async () => {
    const { fetchImpl, calls } = createFakeFetch((call, index) => {
      if (index === 0) return jsonResponse(200, { path: 'work/producer/notes.md', content: 'hi' });
      if (index === 1) return jsonResponse(200, { path: 'work/producer/notes.md', bytes: 2 });
      return jsonResponse(201, { path: 'raw/aroll/copy.mp4' });
    });
    const testClient = client(fetchImpl);

    await testClient.readProjectText('work/producer/notes.md');
    await testClient.writeProjectText('work/producer/notes.md', 'hi');
    await testClient.copyAsset('raw/aroll/a.mp4', 'aroll', 'copy.mp4');

    expect(calls[0]?.url).toContain('/text?path=work%2Fproducer%2Fnotes.md');
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ path: 'work/producer/notes.md', content: 'hi' });
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ from: 'raw/aroll/a.mp4', role: 'aroll', filename: 'copy.mp4' });
  });

  it('listVoices maps language to its code and picks the default voice id', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(200, {
        voices: [
          { id: 'a', label: 'A', language: { code: 'es-AR', region: 'AR' }, quality: 'high', description: '', isDefault: false },
          { id: 'b', label: 'B', language: { code: 'en-US', region: 'US' }, quality: null, description: '', isDefault: true },
        ],
      }),
    );

    const result = await client(fetchImpl).listVoices();

    expect(result.defaultVoiceId).toBe('b');
    expect(result.voices).toHaveLength(2);
  });

  it('createJob sends the body to POST /jobs and maps an unmapped 422 to JOB_REJECTED', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(422, 'MONTAGE_PRESET_INVALID'));

    await expect(client(fetchImpl).createJob({ kind: 'montage', preset: 'nope' })).rejects.toMatchObject({
      code: 'JOB_REJECTED',
    });
  });

  it('getJob maps RENDER_JOB_NOT_FOUND to JOB_NOT_FOUND', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(404, 'RENDER_JOB_NOT_FOUND'));

    await expect(client(fetchImpl).getJob('nope')).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' });
  });

  it('cancelJob maps RENDER_JOB_NOT_CANCELABLE to JOB_REJECTED', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(409, 'RENDER_JOB_NOT_CANCELABLE'));

    await expect(client(fetchImpl).cancelJob('job-1')).rejects.toMatchObject({ code: 'JOB_REJECTED' });
  });

  it('getTimeline maps TIMELINE_NOT_FOUND to FILE_NOT_FOUND (default context, not start-job)', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(404, 'TIMELINE_NOT_FOUND'));

    await expect(client(fetchImpl).getTimeline()).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('putTimeline sends the timeline document as the body directly, not wrapped', async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, { slug: 'pitch-deck', path: 'work/timeline.json' }));

    await client(fetchImpl).putTimeline({ format: 'reels-9x16' });

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ format: 'reels-9x16' });
  });

  it('searchFreeMusic and importMusic round-trip', async () => {
    const { fetchImpl, calls } = createFakeFetch((_call, index) => {
      if (index === 0) return jsonResponse(200, { results: [{ resultId: 'commons-1', title: 't', durationMs: 1, license: 'CC0', author: 'a', pageUrl: 'u' }] });
      return jsonResponse(200, { path: 'raw/audio/a.mp3', credit: { title: 't' } });
    });
    const testClient = client(fetchImpl);

    const results = await testClient.searchFreeMusic('calm piano', 5);
    const imported = await testClient.importMusic('commons-1');

    expect(results).toHaveLength(1);
    expect(imported.path).toBe('raw/audio/a.mp3');
    expect(calls[0]?.url).toContain('mood=calm%20piano');
  });

  it('searchFreeMedia and importMedia round-trip', async () => {
    const { fetchImpl, calls } = createFakeFetch((_call, index) => {
      if (index === 0) {
        return jsonResponse(200, {
          results: [
            {
              resultId: 'commons-video-1',
              source: 'commons',
              kind: 'video',
              title: 't',
              license: 'CC0',
              author: 'a',
              pageUrl: 'u',
              durationMs: 5000,
              width: null,
              height: null,
            },
          ],
        });
      }
      return jsonResponse(200, { path: 'raw/broll/a.mp4', credit: { title: 't' } });
    });
    const testClient = client(fetchImpl);

    const results = await testClient.searchFreeMedia('ocean waves', 'video', 5);
    const imported = await testClient.importMedia('commons-video-1');

    expect(results).toHaveLength(1);
    expect(imported.path).toBe('raw/broll/a.mp4');
    expect(calls[0]?.url).toContain('query=ocean%20waves');
    expect(calls[0]?.url).toContain('kind=video');
  });

  it('previewImages posts the paths and returns the preview list', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse(200, { previews: [{ path: 'raw/images/a.jpg', previewPath: 'work/frames/previews/a.jpg' }] }),
    );

    const previews = await client(fetchImpl).previewImages(['raw/images/a.jpg']);

    expect(previews).toEqual([{ path: 'raw/images/a.jpg', previewPath: 'work/frames/previews/a.jpg' }]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ paths: ['raw/images/a.jpg'] });
  });

  it('listMotionBrands reads the global brands route', async () => {
    const brands = [{ id: 'acme', name: 'Acme', formats: ['16:9'], music: [] }];
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, brands));

    expect(await client(fetchImpl).listMotionBrands()).toEqual(brands);
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/motion/brands');
  });

  it('getMotionBrief and getMotionStoryboard read the project motion routes', async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, { version: 1 }));
    const api = client(fetchImpl);

    await api.getMotionBrief();
    await api.getMotionStoryboard();

    expect(calls.map((call) => call.url)).toEqual([
      'http://127.0.0.1:4599/projects/pitch-deck/motion/brief',
      'http://127.0.0.1:4599/projects/pitch-deck/motion/storyboard',
    ]);
  });

  it('putMotionBrief PUTs the brief as the body', async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, { ok: true }));

    await client(fetchImpl).putMotionBrief({ version: 1, brand: 'acme' });

    expect(calls[0]?.init?.method).toBe('PUT');
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/projects/pitch-deck/motion/brief');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ version: 1, brand: 'acme' });
  });

  it('maps BRIEF_INVALID to INVALID_INPUT keeping the field hint', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(400, 'BRIEF_INVALID', 'images.0.caption: required'));

    await expect(client(fetchImpl).putMotionBrief({})).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      hint: 'images.0.caption: required',
    });
  });

  it('maps a missing storyboard to FILE_NOT_FOUND', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(404, 'STORYBOARD_NOT_FOUND'));

    await expect(client(fetchImpl).getMotionStoryboard()).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('maps STORYBOARD_MISSING and MOTION_PROJECT_REQUIRED on start-job to JOB_REJECTED', async () => {
    const missing = createFakeFetch(() => errorResponse(409, 'STORYBOARD_MISSING'));
    const wrongMode = createFakeFetch(() => errorResponse(409, 'MOTION_PROJECT_REQUIRED'));

    await expect(client(missing.fetchImpl).createJob({ kind: 'motion' })).rejects.toMatchObject({ code: 'JOB_REJECTED' });
    await expect(client(wrongMode.fetchImpl).createJob({ kind: 'motion' })).rejects.toMatchObject({ code: 'JOB_REJECTED' });
  });

  it('maps a fetch rejection (network failure) into STUDIO_UNAVAILABLE', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    await expect(client(fetchImpl).getProjectDetail()).rejects.toMatchObject({ code: 'STUDIO_UNAVAILABLE' });
  });

  it('falls back to STUDIO_UNAVAILABLE for an unrecognized code outside a start-job context', async () => {
    const { fetchImpl } = createFakeFetch(() => errorResponse(500, 'INTERNAL_ERROR'));

    await expect(client(fetchImpl).getProjectDetail()).rejects.toMatchObject({ code: 'STUDIO_UNAVAILABLE' });
  });

  it('redacts an absolute host path that leaks into a hint', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      errorResponse(422, 'INVALID_INPUT', 'bad path /Users/dev/secret/project/file.mp4 rejected'),
    );

    const failure = client(fetchImpl).probeMedia('x');
    await expect(failure).rejects.toBeInstanceOf(StudioToolRuntimeError);
    await expect(failure).rejects.toMatchObject({ hint: 'bad path <path> rejected' });
  });

  it('sends x-studio-token on every request when accessToken is configured (US-017-205)', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse(200, { slug: 'pitch-deck', layout: { timeline: true }, assetSource: 'catalog', assetCounts: {} }),
    );

    await createHttpRenderApiClient({
      apiUrl: 'http://127.0.0.1:4599',
      slug: 'pitch-deck',
      fetchImpl,
      accessToken: 'secret-token',
    }).getProjectDetail();

    const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
    expect(headers?.[STUDIO_TOKEN_HEADER]).toBe('secret-token');
  });

  it('does not send x-studio-token when no accessToken is configured', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse(200, { slug: 'pitch-deck', layout: { timeline: true }, assetSource: 'catalog', assetCounts: {} }),
    );

    await client(fetchImpl).getProjectDetail();

    const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
    expect(headers?.[STUDIO_TOKEN_HEADER]).toBeUndefined();
  });

  it('sends x-studio-token on readFileBytes too, which builds its request outside raw()', async () => {
    const { fetchImpl, calls } = createFakeFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    await createHttpRenderApiClient({
      apiUrl: 'http://127.0.0.1:4599',
      slug: 'pitch-deck',
      fetchImpl,
      accessToken: 'secret-token',
    }).readFileBytes('work/producer/script.txt');

    const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
    expect(headers?.[STUDIO_TOKEN_HEADER]).toBe('secret-token');
  });
});
