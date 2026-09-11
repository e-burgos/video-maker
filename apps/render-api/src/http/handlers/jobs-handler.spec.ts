import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createControllableRenderMutedVideo } from '../../__fixtures__/controllable-render';
import type { FakeObjectStorageSeed } from '../../__fixtures__/fake-object-storage';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeAiAgent } from '../../__fixtures__/fake-ai-agent';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { buildMinimalTimeline } from '../../__fixtures__/minimal-timeline';
import { buildStoryboardDocument, buildStoryboardProposal } from '../../__fixtures__/storyboard-fixtures';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import type { Job, RenderJob } from '../../jobs/render-job';
import type { HttpRequestLine } from '../http-message';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleCancelRenderJob,
  handleCreateRenderJob,
  handleGetRenderJob,
  handleListRenderJobs,
} from './jobs-handler';

const STORE: StoreConfig = { mediaRoot: '/media', maxUploadBytes: 2_147_483_648, objectStore: 'fs' };
const PROJECT_ROOT = '/var/data/media/acme-launch';
const DEFAULT_RENDER_OUTPUT = {
  outPath: `${PROJECT_ROOT}/work/renders/r/video-muted.mp4`,
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 144,
};

const RENDER_JOB_RESPONSE_KEYS = [
  'id',
  'slug',
  'kind',
  'state',
  'createdAt',
  'startedAt',
  'finishedAt',
  'error',
  'progress',
  'report',
].sort();

const JOB_SUMMARY_RESPONSE_KEYS = ['id', 'kind', 'state', 'stage', 'errorCode', 'createdAt', 'startedAt', 'finishedAt'].sort();

const WRITE_PORTS = ['writeTextFile', 'ensureDirectory', 'writeTemporary', 'promoteTemporary', 'removeTemporary'];

function isAsciiOnly(text: string): boolean {
  return Array.from(text).every((character) => character.charCodeAt(0) < 128);
}

async function* toChunks(values: readonly string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) {
    yield encoder.encode(value);
  }
}

function noBodyRequest(slug: string): HttpRequestLine {
  return requestLine({ method: 'POST', path: `/projects/${slug}/jobs` });
}

function jsonBodyRequest(slug: string, payload: unknown): HttpRequestLine {
  return requestLine({ method: 'POST', path: `/projects/${slug}/jobs`, body: toChunks([JSON.stringify(payload)]) });
}

function rawBodyRequest(slug: string, raw: string): HttpRequestLine {
  return requestLine({ method: 'POST', path: `/projects/${slug}/jobs`, body: toChunks([raw]) });
}

describe('handleCreateRenderJob', () => {
  it('answers 202 with a service-generated id and enqueues exactly one job', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleCreateRenderJob(
      deps,
      STORE,
      { slug: 'smoke-ingest' },
      noBodyRequest('smoke-ingest'),
      runtime,
    );
    const body = response.body as RenderJob;

    expect(response.status).toBe(202);
    expect(response.headers.location).toBe(`/jobs/${body.id}`);
    expect(runtime.jobs.listBySlug('smoke-ingest')).toHaveLength(1);
    expect(runtime.jobs.listBySlug('smoke-ingest')[0]?.id).toBe(body.id);

    await runtime.jobs.whenIdle();
  });

  interface RejectionCase {
    readonly title: string;
    readonly code: string;
    readonly slug: string;
    readonly seed?: FakeObjectStorageSeed;
  }

  const REJECTION_CASES: readonly RejectionCase[] = [
    { title: 'PROJECT_SLUG_INVALID', code: 'PROJECT_SLUG_INVALID', slug: 'Not_A_Slug' },
    { title: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND', slug: 'missing-project' },
    {
      title: 'TIMELINE_NOT_FOUND',
      code: 'TIMELINE_NOT_FOUND',
      slug: 'smoke-ingest',
      seed: { directories: [`${STORE.mediaRoot}/smoke-ingest`] },
    },
    {
      title: 'TIMELINE_INVALID',
      code: 'TIMELINE_INVALID',
      slug: 'smoke-ingest',
      seed: {
        directories: [`${STORE.mediaRoot}/smoke-ingest`],
        files: [
          { path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify({ not: 'valid' }) },
        ],
      },
    },
  ];

  it.each(REJECTION_CASES)('answers $code and registers no job', async ({ code, slug, seed }) => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, seed);
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const runtime = createRenderApiRuntime(deps);

    await expect(
      handleCreateRenderJob(deps, STORE, { slug }, noBodyRequest(slug), runtime),
    ).rejects.toMatchObject({ code });
    expect(runtime.jobs.listBySlug(slug)).toEqual([]);
  });

  describe('kind resolution and render retro-compatibility (CA-001/CA-002/CA-003)', () => {
    interface RetroCompatCase {
      readonly title: string;
      readonly request: (slug: string) => HttpRequestLine;
    }

    const RETRO_COMPAT_CASES: readonly RetroCompatCase[] = [
      { title: 'CA-001: no body at all', request: (slug) => noBodyRequest(slug) },
      { title: 'CA-002: an empty JSON object body', request: (slug) => jsonBodyRequest(slug, {}) },
      {
        title: 'CA-003: a body that mentions no kind but carries montage-only fields',
        request: (slug) => jsonBodyRequest(slug, { preset: 'hardware', seed: 7, overwrite: true }),
      },
      {
        title: 'a body that explicitly requests kind:render alongside ignored montage fields',
        request: (slug) => jsonBodyRequest(slug, { kind: 'render', preset: 'hardware', seed: 7, overwrite: true }),
      },
    ];

    it.each(RETRO_COMPAT_CASES)('$title produces the exact same RenderJob key set as before this cycle', async ({ request }) => {
      const callLog = createCallLog();
      const timeline = buildMinimalTimeline();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/smoke-ingest`],
        files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`, contents: JSON.stringify(timeline) }],
      });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      const runtime = createRenderApiRuntime(deps);

      const response = await handleCreateRenderJob(deps, STORE, { slug: 'smoke-ingest' }, request('smoke-ingest'), runtime);
      const body = response.body as RenderJob;

      expect(response.status).toBe(202);
      expect(body.kind).toBe('render');
      expect(Object.keys(body).sort()).toEqual(RENDER_JOB_RESPONSE_KEYS);
      expect(runtime.jobs.listBySlug('smoke-ingest')).toHaveLength(1);

      await runtime.jobs.whenIdle();
    });
  });

  describe('resolveJobKind', () => {
    it('answers 422 JOB_KIND_INVALID for an unknown kind and registers no job', async () => {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog);
      const runtime = createRenderApiRuntime(deps);

      await expect(
        handleCreateRenderJob(deps, STORE, { slug: 'acme-launch' }, jsonBodyRequest('acme-launch', { kind: 'bogus' }), runtime),
      ).rejects.toMatchObject({ code: 'JOB_KIND_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('answers 400 REQUEST_BODY_INVALID_JSON for a syntactically invalid body', async () => {
      const callLog = createCallLog();
      const deps = createFakeRenderApiDependencies(callLog);
      const runtime = createRenderApiRuntime(deps);

      await expect(
        handleCreateRenderJob(deps, STORE, { slug: 'acme-launch' }, rawBodyRequest('acme-launch', 'not json'), runtime),
      ).rejects.toMatchObject({ code: 'REQUEST_BODY_INVALID_JSON' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });
  });

  describe('montage parameter validation (§7)', () => {
    function createMontageDeps(): { deps: ReturnType<typeof createFakeRenderApiDependencies>; runtime: ReturnType<typeof createRenderApiRuntime> } {
      const callLog = createCallLog();
      const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/acme-launch`] });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      return { deps, runtime: createRenderApiRuntime(deps) };
    }

    it('answers 422 MONTAGE_PRESET_INVALID and registers no job', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage', preset: 'nope' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'MONTAGE_PRESET_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('answers 422 MONTAGE_SEED_INVALID and registers no job', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage', seed: -1 }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('answers 422 MONTAGE_SCRIPT_INVALID when scriptPath and scriptText are both sent (spec-014)', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', {
            kind: 'montage',
            scriptPath: 'work/producer/script.txt',
            scriptText: 'hola',
          }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'MONTAGE_SCRIPT_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('answers 422 MONTAGE_LOGO_INVALID and registers no job (spec-014)', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage', logo: 'maybe' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'MONTAGE_LOGO_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('answers 422 MONTAGE_FORMAT_INVALID and registers no job (FIX-e-burgos-007-001)', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage', format: '4k' }),
          runtime,
        ),
      ).rejects.toMatchObject({
        code: 'MONTAGE_FORMAT_INVALID',
        expected: 'one of reels-9x16, tiktok-9x16, shorts-9x16, youtube-16x9',
      });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });

    it('accepts one of the four output formats (FIX-e-burgos-007-001)', async () => {
      const { deps, runtime } = createMontageDeps();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'acme-launch' },
        jsonBodyRequest('acme-launch', { kind: 'montage', format: 'youtube-16x9' }),
        runtime,
      );

      expect(response.status).toBe(202);

      await runtime.jobs.whenIdle();
    });

    it('registers the montage job with the script and the logo mode it received (spec-014)', async () => {
      const { deps, runtime } = createMontageDeps();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'acme-launch' },
        jsonBodyRequest('acme-launch', {
          kind: 'montage',
          scriptPath: 'work/producer/script.txt',
          logo: 'off',
        }),
        runtime,
      );

      expect(response.status).toBe(202);
      expect(runtime.jobs.listBySlug('acme-launch')).toHaveLength(1);
    });

    it('answers 422 MONTAGE_OVERWRITE_INVALID and registers no job', async () => {
      const { deps, runtime } = createMontageDeps();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage', overwrite: 'yes' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'MONTAGE_OVERWRITE_INVALID' });
      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
    });
  });

  describe('montage job creation', () => {
    it('answers 202 with kind montage and default preset/seed/overwrite when omitted', async () => {
      const callLog = createCallLog();
      const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/acme-launch`] });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      const runtime = createRenderApiRuntime(deps);

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'acme-launch' },
        jsonBodyRequest('acme-launch', { kind: 'montage' }),
        runtime,
      );
      const body = response.body as Job;

      expect(response.status).toBe(202);
      expect(body.kind).toBe('montage');
      expect(Object.keys(body).sort()).toEqual(RENDER_JOB_RESPONSE_KEYS);
      expect(runtime.jobs.listBySlug('acme-launch')).toHaveLength(1);

      await runtime.jobs.whenIdle();
    });

    it('answers 202 with kind montage honoring explicit preset, seed and overwrite', async () => {
      const callLog = createCallLog();
      const timeline = buildMinimalTimeline();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/acme-launch`],
        files: [{ path: `${STORE.mediaRoot}/acme-launch/work/timeline.json`, contents: JSON.stringify(timeline) }],
      });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      const runtime = createRenderApiRuntime(deps);

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'acme-launch' },
        jsonBodyRequest('acme-launch', { kind: 'montage', preset: 'hardware', seed: 7, overwrite: true }),
        runtime,
      );
      const body = response.body as Job;

      expect(response.status).toBe(202);
      expect(body.kind).toBe('montage');
      expect(runtime.jobs.listBySlug('acme-launch')).toHaveLength(1);

      await runtime.jobs.whenIdle();
    });
  });

  describe('montage precondition — timeline already persisted (CA-009/CA-010)', () => {
    it('answers 409 TIMELINE_ALREADY_EXISTS, registers no job and writes nothing', async () => {
      const callLog = createCallLog();
      const timeline = buildMinimalTimeline();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/acme-launch`],
        files: [{ path: `${STORE.mediaRoot}/acme-launch/work/timeline.json`, contents: JSON.stringify(timeline) }],
      });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      const runtime = createRenderApiRuntime(deps);

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'acme-launch' },
          jsonBodyRequest('acme-launch', { kind: 'montage' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'TIMELINE_ALREADY_EXISTS' });

      expect(runtime.jobs.listBySlug('acme-launch')).toEqual([]);
      expect(callLog.entries().filter((entry) => WRITE_PORTS.includes(entry.port))).toEqual([]);
    });

    it('answers 202 and registers the job when overwrite is true', async () => {
      const callLog = createCallLog();
      const timeline = buildMinimalTimeline();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/acme-launch`],
        files: [{ path: `${STORE.mediaRoot}/acme-launch/work/timeline.json`, contents: JSON.stringify(timeline) }],
      });
      const deps = createFakeRenderApiDependencies(callLog, { storage });
      const runtime = createRenderApiRuntime(deps);

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'acme-launch' },
        jsonBodyRequest('acme-launch', { kind: 'montage', overwrite: true }),
        runtime,
      );

      expect(response.status).toBe(202);
      expect(runtime.jobs.listBySlug('acme-launch')).toHaveLength(1);

      await runtime.jobs.whenIdle();
    });
  });

  describe('storyboard job creation', () => {
    const STORYBOARD_KEYS = RENDER_JOB_RESPONSE_KEYS;

    function storyboardHarness(seed?: FakeObjectStorageSeed) {
      const callLog = createCallLog();
      const storage = createFakeObjectStorage(callLog, {
        directories: [`${STORE.mediaRoot}/smoke-ingest`, `${STORE.mediaRoot}/smoke-ingest/work`],
        ...(seed ?? {}),
      });
      const fakeAgent = createFakeAiAgent(buildStoryboardProposal(), callLog);
      const deps = createFakeRenderApiDependencies(callLog, { storage, aiAgent: fakeAgent.agent });
      return { deps, storage, fakeAgent, runtime: createRenderApiRuntime(deps) };
    }

    it('answers 202 with kind storyboard and the same job envelope as the other kinds', async () => {
      const { deps, runtime } = storyboardHarness();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'Un video sobre Nx.' }),
        runtime,
      );
      const body = response.body as Job;

      expect(response.status).toBe(202);
      expect(response.headers.location).toBe(`/jobs/${body.id}`);
      expect(body.kind).toBe('storyboard');
      expect(Object.keys(body).sort()).toEqual(STORYBOARD_KEYS);
      expect(runtime.jobs.listBySlug('smoke-ingest')).toHaveLength(1);

      await runtime.jobs.whenIdle();
    });

    it('accepts scriptText as the alternative input', async () => {
      const { deps, runtime } = storyboardHarness();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', scriptText: 'Hola. Hoy vemos Nx.' }),
        runtime,
      );

      expect(response.status).toBe(202);

      await runtime.jobs.whenIdle();
    });

    interface StoryboardRejectionCase {
      readonly title: string;
      readonly code: string;
      readonly body: Record<string, unknown>;
    }

    const STORYBOARD_REJECTIONS: readonly StoryboardRejectionCase[] = [
      { title: 'no input at all', code: 'STORYBOARD_INPUT_INVALID', body: { kind: 'storyboard' } },
      {
        title: 'both brief and scriptText',
        code: 'STORYBOARD_INPUT_INVALID',
        body: { kind: 'storyboard', brief: 'idea', scriptText: 'guion' },
      },
      {
        title: 'a blank brief',
        code: 'STORYBOARD_INPUT_INVALID',
        body: { kind: 'storyboard', brief: '   ' },
      },
      {
        title: 'a non-boolean overwrite',
        code: 'STORYBOARD_OVERWRITE_INVALID',
        body: { kind: 'storyboard', brief: 'idea', overwrite: 'yes' },
      },
    ];

    it.each(STORYBOARD_REJECTIONS)('rejects $title with $code and registers no job', async ({ code, body }) => {
      const { deps, runtime } = storyboardHarness();

      await expect(
        handleCreateRenderJob(deps, STORE, { slug: 'smoke-ingest' }, jsonBodyRequest('smoke-ingest', body), runtime),
      ).rejects.toMatchObject({ code });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('forwards the model of the request to the agent and defaults to the service model', async () => {
      const { deps, fakeAgent, runtime } = storyboardHarness();

      await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'idea', model: 'haiku' }),
        runtime,
      );
      await runtime.jobs.whenIdle();

      await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'otra idea', overwrite: true }),
        runtime,
      );
      await runtime.jobs.whenIdle();

      expect(fakeAgent.requests.map((request) => request.model)).toEqual(['haiku', null]);
    });

    it('rejects a model outside PRODUCER_MODELS with JOB_MODEL_INVALID and registers no job', async () => {
      const { deps, runtime } = storyboardHarness();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'idea', model: 'gpt-5' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'JOB_MODEL_INVALID', expected: 'one of sonnet, opus, haiku' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('rejects a model outside PRODUCER_MODELS on a voice job too', async () => {
      const { deps, runtime } = storyboardHarness();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'voice', model: 'gpt-5' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'JOB_MODEL_INVALID' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('rejects an unknown kind and names the four valid ones', async () => {
      const { deps, runtime } = storyboardHarness();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'assemble' }),
          runtime,
        ),
      ).rejects.toMatchObject({
        code: 'JOB_KIND_INVALID',
        expected: "'render', 'montage', 'storyboard' or 'voice'",
      });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('answers 202 with kind voice and registers the job with the requested scenes (US-09-004)', async () => {
      const { deps, runtime } = storyboardHarness({
        files: [
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`,
            contents: JSON.stringify(buildStoryboardDocument()),
          },
        ],
      });

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'voice', sceneIds: ['scene-02'] }),
        runtime,
      );
      const body = response.body as Job;

      expect(response.status).toBe(202);
      expect(response.headers.location).toBe(`/jobs/${body.id}`);
      expect(body.kind).toBe('voice');
      expect(Object.keys(body).sort()).toEqual(STORYBOARD_KEYS);

      await runtime.jobs.whenIdle();
    });

    it('a voice job without a stored storyboard is 404 STORYBOARD_NOT_FOUND and registers no job (US-09-004)', async () => {
      const { deps, runtime } = storyboardHarness();

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'voice' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'STORYBOARD_NOT_FOUND' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('a voice job with a script needs no storyboard at all (FIX-e-burgos-009-001)', async () => {
      const { deps, runtime } = storyboardHarness();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'voice', scriptText: 'Primera.\nSegunda.' }),
        runtime,
      );

      expect(response.status).toBe(202);
      expect((response.body as Job).kind).toBe('voice');

      await runtime.jobs.whenIdle();
    });

    it('a voice job with a script is 409 VOICE_ALREADY_EXISTS when work/voice/voice.wav is there (FIX-e-burgos-009-001)', async () => {
      const { deps, runtime } = storyboardHarness({
        files: [{ path: `${STORE.mediaRoot}/smoke-ingest/work/voice/voice.wav`, contents: 'RIFF' }],
      });

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'voice', scriptText: 'Primera.' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'VOICE_ALREADY_EXISTS', resource: 'work/voice/voice.wav' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'voice', scriptText: 'Primera.', overwrite: true }),
        runtime,
      );

      expect(response.status).toBe(202);

      await runtime.jobs.whenIdle();
    });

    it('a voice job naming a scene outside the storyboard is 404 and registers no job (US-09-005)', async () => {
      const { deps, runtime } = storyboardHarness({
        files: [
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`,
            contents: JSON.stringify(buildStoryboardDocument()),
          },
        ],
      });

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'voice', sceneIds: ['scene-09'] }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'VOICE_SCENE_NOT_FOUND', resource: 'scene-09' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('answers 409 VOICE_ALREADY_EXISTS without overwrite and registers no job (US-09-005)', async () => {
      const manifest = {
        schemaVersion: 1,
        storyboardId: 'storyboard-0001',
        language: 'es-AR',
        tracks: [
          {
            sceneId: 'scene-01',
            index: 1,
            source: 'generated',
            path: 'work/voice/scene-01.wav',
            wordsPath: 'work/voice/scene-01.words.json',
            durationMs: 4200,
            sampleRate: 48000,
            voiceId: 'es_AR-daniela-high',
            narrationHash: 'abcdef0123456789',
            updatedAt: '2026-09-09T12:00:00.000Z',
          },
        ],
      };
      const { deps, runtime } = storyboardHarness({
        files: [
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`,
            contents: JSON.stringify(buildStoryboardDocument()),
          },
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/voice/manifest.json`,
            contents: JSON.stringify(manifest),
          },
        ],
      });

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'voice' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'VOICE_ALREADY_EXISTS' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);

      const accepted = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'voice', overwrite: true }),
        runtime,
      );

      expect(accepted.status).toBe(202);
      await runtime.jobs.whenIdle();
    });

    it('answers 409 STORYBOARD_ALREADY_EXISTS without overwrite and registers no job', async () => {
      const { deps, runtime } = storyboardHarness({
        files: [
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`,
            contents: JSON.stringify(buildStoryboardDocument()),
          },
        ],
      });

      await expect(
        handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'idea' }),
          runtime,
        ),
      ).rejects.toMatchObject({ code: 'STORYBOARD_ALREADY_EXISTS', resource: 'work/storyboard.json' });
      expect(runtime.jobs.listBySlug('smoke-ingest')).toEqual([]);
    });

    it('answers 202 with overwrite true over an existing storyboard', async () => {
      const { deps, runtime } = storyboardHarness({
        files: [
          {
            path: `${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`,
            contents: JSON.stringify(buildStoryboardDocument()),
          },
        ],
      });

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'idea', overwrite: true }),
        runtime,
      );

      expect(response.status).toBe(202);

      await runtime.jobs.whenIdle();
    });

    it('runs the job to succeeded and reports the storyboard it wrote', async () => {
      const { deps, runtime, storage } = storyboardHarness();

      const response = await handleCreateRenderJob(
        deps,
        STORE,
        { slug: 'smoke-ingest' },
        jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'Un video sobre Nx.' }),
        runtime,
      );
      const created = response.body as Job;

      await runtime.jobs.whenIdle();
      const finished = runtime.jobs.get(created.id);

      expect(finished?.state).toBe('succeeded');
      expect(finished?.report).toMatchObject({ storyboardPath: 'work/storyboard.json', sceneCount: 3 });
      expect(await storage.stat(`${STORE.mediaRoot}/smoke-ingest/work/storyboard.json`)).not.toBeNull();
    });

    it('cancels a queued storyboard job with 200 and canceled', async () => {
      const { deps, runtime } = storyboardHarness();

      const first = (
        await handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'primero' }),
          runtime,
        )
      ).body as Job;
      const second = (
        await handleCreateRenderJob(
          deps,
          STORE,
          { slug: 'smoke-ingest' },
          jsonBodyRequest('smoke-ingest', { kind: 'storyboard', brief: 'segundo', overwrite: true }),
          runtime,
        )
      ).body as Job;

      const cancellation = await handleCancelRenderJob({ jobId: second.id }, runtime);

      expect(cancellation.status).toBe(200);
      expect((cancellation.body as Job).state).toBe('canceled');
      expect((cancellation.body as Job).report).toBeNull();

      await runtime.jobs.whenIdle();
      expect(runtime.jobs.get(first.id)?.state).toBe('succeeded');
    });
  });
});

describe('handleListRenderJobs', () => {
  it('answers 200 with an empty jobs array for a slug without jobs', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const response = await handleListRenderJobs({ slug: 'smoke-ingest' }, runtime);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ slug: 'smoke-ingest', jobs: [] });
  });

  it('answers 200 with the exact JobSummary key set on every entry (§8.2)', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    runtime.jobs.create({ kind: 'render', slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });

    const response = await handleListRenderJobs({ slug: 'acme-launch' }, runtime);
    const body = response.body as { readonly jobs: readonly Record<string, unknown>[] };

    expect(response.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
    expect(Object.keys(body.jobs[0] as Record<string, unknown>).sort()).toEqual(JOB_SUMMARY_RESPONSE_KEYS);

    await runtime.jobs.whenIdle();
  });
});

describe('handleGetRenderJob', () => {
  it('answers 404 RENDER_JOB_NOT_FOUND for an id that was never created', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    await expect(handleGetRenderJob({ jobId: 'unknown-id' }, runtime)).rejects.toMatchObject({
      code: 'RENDER_JOB_NOT_FOUND',
    });
  });

  it('answers 200 with state failed and the embedded typed error', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, {
      muxAudioIntoVideo: async () => {
        throw new Error('mux exploded');
      },
    });
    const runtime = createRenderApiRuntime(deps);

    const job = runtime.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    await runtime.jobs.whenIdle();

    const response = await handleGetRenderJob({ jobId: job.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(200);
    expect(body.state).toBe('failed');
    expect(body.error?.code).toBe('INTERNAL_ERROR');
    expect(body.error?.stage).toBe('mux');
  });

  it('answers 200 with the exact Job key set (§8.3)', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const created = runtime.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    await runtime.jobs.whenIdle();

    const response = await handleGetRenderJob({ jobId: created.id }, runtime);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual(RENDER_JOB_RESPONSE_KEYS);
  });
});

describe('handleCancelRenderJob', () => {
  it('answers 200 with state canceled for a queued job', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const runtime = createRenderApiRuntime(deps);

    runtime.jobs.create({ kind: 'render', slug: 'acme-launch', projectRoot: PROJECT_ROOT, timeline: buildMinimalTimeline() });
    const second = runtime.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    expect(second.state).toBe('queued');

    const response = await handleCancelRenderJob({ jobId: second.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(200);
    expect(body.state).toBe('canceled');

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await runtime.jobs.whenIdle();
  });

  it('answers 202 with state canceling for a running job', async () => {
    const callLog = createCallLog();
    const controllable = createControllableRenderMutedVideo();
    const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
    const runtime = createRenderApiRuntime(deps);

    const job = runtime.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    await controllable.started;

    const response = await handleCancelRenderJob({ jobId: job.id }, runtime);
    const body = response.body as RenderJob;

    expect(response.status).toBe(202);
    expect(body.state).toBe('canceling');

    controllable.resolve(DEFAULT_RENDER_OUTPUT);
    await runtime.jobs.whenIdle();
  });

  const TERMINAL_STATES: ReadonlyArray<{
    readonly title: 'succeeded' | 'failed' | 'canceled';
    readonly settle: (controllable: ReturnType<typeof createControllableRenderMutedVideo>) => void;
  }> = [
    { title: 'succeeded', settle: (controllable) => controllable.resolve(DEFAULT_RENDER_OUTPUT) },
    { title: 'failed', settle: (controllable) => controllable.reject(new Error('render exploded')) },
    { title: 'canceled', settle: (controllable) => controllable.resolve(DEFAULT_RENDER_OUTPUT) },
  ];

  it.each(TERMINAL_STATES)(
    'answers 409 RENDER_JOB_NOT_CANCELABLE and leaves the state untouched ($title)',
    async ({ title, settle }) => {
      const callLog = createCallLog();
      const controllable = createControllableRenderMutedVideo();
      const deps = createFakeRenderApiDependencies(callLog, { renderMutedVideo: controllable.port });
      const runtime = createRenderApiRuntime(deps);

      const job = runtime.jobs.create({
        kind: 'render',
        slug: 'acme-launch',
        projectRoot: PROJECT_ROOT,
        timeline: buildMinimalTimeline(),
      });
      await controllable.started;

      if (title === 'canceled') {
        runtime.jobs.cancel(job.id);
      }
      settle(controllable);
      await runtime.jobs.whenIdle();

      expect(runtime.jobs.get(job.id)?.state).toBe(title);

      await expect(handleCancelRenderJob({ jobId: job.id }, runtime)).rejects.toMatchObject({
        code: 'RENDER_JOB_NOT_CANCELABLE',
      });
      expect(runtime.jobs.get(job.id)?.state).toBe(title);
    },
  );

  it('answers 404 RENDER_JOB_NOT_FOUND when cancelling an id that was never created', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    await expect(handleCancelRenderJob({ jobId: 'unknown-id' }, runtime)).rejects.toMatchObject({
      code: 'RENDER_JOB_NOT_FOUND',
    });
  });

  it('answers the two queue errors with a payload free of stack, of Spanish text and of absolute paths', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    const runtime = createRenderApiRuntime(deps);

    const notFoundError = await handleCancelRenderJob({ jobId: 'unknown-id' }, runtime).catch(
      (error: unknown) => error,
    );
    const notFoundPayload = toErrorPayload(notFoundError);

    expect(notFoundPayload.code).toBe('RENDER_JOB_NOT_FOUND');
    expect(isAsciiOnly(notFoundPayload.message)).toBe(true);
    expect('stack' in notFoundPayload).toBe(false);
    expect(notFoundPayload.resource?.startsWith('/')).toBe(false);

    const job = runtime.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: PROJECT_ROOT,
      timeline: buildMinimalTimeline(),
    });
    await runtime.jobs.whenIdle();

    const notCancelableError = await handleCancelRenderJob({ jobId: job.id }, runtime).catch(
      (error: unknown) => error,
    );
    const notCancelablePayload = toErrorPayload(notCancelableError);

    expect(notCancelablePayload.code).toBe('RENDER_JOB_NOT_CANCELABLE');
    expect(isAsciiOnly(notCancelablePayload.message)).toBe(true);
    expect('stack' in notCancelablePayload).toBe(false);
    expect(notCancelablePayload.resource?.startsWith('/')).toBe(false);
  });
});
