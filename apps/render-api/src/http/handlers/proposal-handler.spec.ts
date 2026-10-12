import { ProductionProposalSchema } from '@video-maker/timeline-core';
import type { ProposalConcept } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks } from '../../__fixtures__/fake-fetch-remote';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { OPENROUTER_MODELS_SAMPLE_PAYLOAD } from '../../__fixtures__/openrouter-models-sample';
import type { StoreConfig } from '../../config/store-config';
import { productionProposalPath } from '../../proposal/proposal-paths';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleApproveProposal, handleGetProposal, handlePutProposal } from './proposal-handler';
import type { ProposalBody } from './proposal-handler';

const STORE: StoreConfig = { mediaRoot: '/var/data/media', dbPath: '/var/data/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };
const SLUG = 'acme-launch';
const PROJECT_ROOT = `${STORE.mediaRoot}/${SLUG}`;
const NOW = '2026-10-12T10:00:00.000Z';

function concept(id: string, overrides: Partial<ProposalConcept> = {}): ProposalConcept {
  return {
    id,
    title: `Concepto ${id}`,
    angle: 'Paso a paso',
    format: 'youtube-16x9',
    durationSec: 120,
    scenes: 10,
    delivery: { kind: 'tutorial', requiresVoice: true },
    ...overrides,
  };
}

const DRAFT = { recommendedId: 'directo', concepts: [concept('directo'), concept('reel', { format: 'reels-9x16', durationSec: 30 })] };

function setup(options: { files?: readonly { path: string; contents: string }[]; openrouter?: boolean } = {}) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: (options.files ?? []).map((file) => ({ path: `${PROJECT_ROOT}/${file.path}`, contents: file.contents })),
  });
  const fetch = createFakeFetchRemote({ status: 200, headers: { 'content-type': 'application/json' }, bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD) });
  const deps = createFakeRenderApiDependencies(callLog, { storage, fetchRemote: fetch.fetchRemote, clock: { nowIso: () => NOW } });
  deps.localStore.projects.insert(SLUG);
  if (options.openrouter === true) {
    deps.localStore.settings.set('producer.engine', 'openrouter');
    deps.localStore.settings.set('producer.model.openrouter', 'deepseek/deepseek-v4.1-flash');
  }
  return { deps, storage, runtime: createRenderApiRuntime(deps) };
}

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

function put(body: unknown) {
  return requestLine({ method: 'PUT', path: `/projects/${SLUG}/proposal`, body: jsonBody(body) });
}

function approve(body: unknown) {
  return requestLine({ method: 'POST', path: `/projects/${SLUG}/proposal/approve`, body: jsonBody(body) });
}

describe('proposal handlers (US-023-401, US-023-402, US-023-403)', () => {
  it('answers a null proposal and no estimates for a project without one', async () => {
    const { deps, runtime } = setup();

    const response = await handleGetProposal(deps, STORE, { slug: SLUG }, runtime);
    const body = response.body as ProposalBody;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['engine', 'estimates', 'path', 'proposal', 'slug']);
    expect(body).toMatchObject({ slug: SLUG, path: productionProposalPath(), proposal: null, estimates: {} });
  });

  it('stores a pending proposal and answers it with one estimate per concept', async () => {
    const { deps, storage, runtime } = setup();

    const response = await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);
    const body = response.body as ProposalBody;

    expect(response.status).toBe(200);
    expect(body.proposal).toMatchObject({ version: 1, status: 'pending', recommendedId: 'directo' });
    expect(Object.keys(body.estimates).sort()).toEqual(['directo', 'reel']);
    expect(Object.keys(body.estimates.directo ?? {}).sort()).toEqual(['basis', 'producerTokens', 'renderMinutes', 'usd', 'voiceMinutes']);
    const stored = ProductionProposalSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/${productionProposalPath()}`)));
    expect(stored.status).toBe('pending');
  });

  it('resets an approved proposal to pending when it is written again, ignoring a status in the body', async () => {
    const { deps, runtime } = setup();
    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);
    await handleApproveProposal(deps, STORE, { slug: SLUG }, approve({ conceptId: 'reel' }), runtime);

    const response = await handlePutProposal(deps, STORE, { slug: SLUG }, put({ ...DRAFT, status: 'approved', approvedConceptId: 'reel' }), runtime);

    expect((response.body as ProposalBody).proposal).toMatchObject({ status: 'pending' });
    expect((response.body as ProposalBody).proposal).not.toHaveProperty('approvedConceptId');
  });

  it.each([
    [{ recommendedId: 'directo', concepts: [concept('directo')] }],
    [{ recommendedId: 'otro', concepts: DRAFT.concepts }],
    [{ recommendedId: 'directo', concepts: [concept('directo', { format: 'cinema' as never }), concept('reel')] }],
    [{}],
  ])('rejects an invalid proposal with INVALID_INPUT (%#)', async (payload) => {
    const { deps, runtime } = setup();

    await expect(handlePutProposal(deps, STORE, { slug: SLUG }, put(payload), runtime)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('approves the chosen concept and records when', async () => {
    const { deps, runtime } = setup();
    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);

    const response = await handleApproveProposal(deps, STORE, { slug: SLUG }, approve({ conceptId: 'reel' }), runtime);

    expect(response.status).toBe(200);
    expect((response.body as ProposalBody).proposal).toMatchObject({ status: 'approved', approvedConceptId: 'reel', approvedAt: NOW });
    const again = await handleGetProposal(deps, STORE, { slug: SLUG }, runtime);
    expect((again.body as ProposalBody).proposal).toMatchObject({ status: 'approved', approvedConceptId: 'reel' });
  });

  it('refuses to approve without a proposal (PROPOSAL_NOT_FOUND) or with an unknown concept (INVALID_INPUT)', async () => {
    const { deps, runtime } = setup();

    await expect(handleApproveProposal(deps, STORE, { slug: SLUG }, approve({ conceptId: 'directo' }), runtime)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND' });

    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);
    await expect(handleApproveProposal(deps, STORE, { slug: SLUG }, approve({ conceptId: 'nope' }), runtime)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(handleApproveProposal(deps, STORE, { slug: SLUG }, approve({}), runtime)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('recalculates the estimate from the jobs of the studio on every read', async () => {
    const { deps, runtime } = setup();
    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);
    const before = (await handleGetProposal(deps, STORE, { slug: SLUG }, runtime)).body as ProposalBody;
    expect(before.estimates.directo?.basis.render.source).toBe('default');

    for (const [id, processSec] of [['job-a', 60], ['job-b', 60]] as const) {
      deps.localStore.jobs.insert({ id, slug: SLUG, kind: 'render', state: 'queued', params: { kind: 'render', timeline: { format: { preset: 'youtube-16x9' } } }, createdAt: NOW });
      deps.localStore.jobs.updateState(id, 'succeeded', '2026-10-12T09:00:00.000Z', new Date(Date.parse('2026-10-12T09:00:00.000Z') + processSec * 1000).toISOString());
      deps.localStore.jobs.setReport(id, { deliverable: { durationInFrames: 900, fps: 30 } });
    }
    const after = (await handleGetProposal(deps, STORE, { slug: SLUG }, runtime)).body as ProposalBody;

    expect(after.estimates.directo?.basis.render).toEqual({ source: 'history-format', samples: 2, processSecPerMediaSec: 2 });
    expect(after.estimates.directo?.renderMinutes).toBe(4);
  });

  it('reports the OpenRouter model, tokens and USD from the catalog price when the producer engine is OpenRouter', async () => {
    const { deps, runtime } = setup({ openrouter: true });
    await deps.secretStore.set('openrouter', 'sk-or-v1-test-key');
    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);

    const body = (await handleGetProposal(deps, STORE, { slug: SLUG }, runtime)).body as ProposalBody;

    expect(body.engine).toEqual({ kind: 'openrouter', model: 'deepseek/deepseek-v4.1-flash' });
    expect(body.estimates.directo?.producerTokens).toEqual({ input: 310_000, output: 18_000 });
    expect(body.estimates.directo?.usd).toBe(Math.round(((310_000 / 1e6) * 0.15 + (18_000 / 1e6) * 0.6) * 1e4) / 1e4);
  });

  it('has no USD with the Claude subscription', async () => {
    const { deps, runtime } = setup();
    await handlePutProposal(deps, STORE, { slug: SLUG }, put(DRAFT), runtime);

    const body = (await handleGetProposal(deps, STORE, { slug: SLUG }, runtime)).body as ProposalBody;

    expect(body.engine).toEqual({ kind: 'claude-cli', model: null });
    expect(body.estimates.directo).toMatchObject({ producerTokens: null, usd: null });
  });
});
