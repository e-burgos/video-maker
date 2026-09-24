import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks } from '../../__fixtures__/fake-fetch-remote';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { OPENROUTER_MODELS_SAMPLE_PAYLOAD } from '../../__fixtures__/openrouter-models-sample';
import { toErrorPayload } from '../../errors/to-error-payload';
import { createRenderApiRuntime } from '../render-api-runtime';
import { handleGetOpenRouterModels } from './openrouter-models-handler';
import type { OpenRouterModelsBody } from './openrouter-models-handler';

function getRequest(path: string) {
  return requestLine({ method: 'GET', path });
}

async function scenario(status = 200) {
  const callLog = createCallLog();
  const { fetchRemote } = createFakeFetchRemote({
    status,
    bodyChunks: status === 200 ? jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD) : undefined,
  });
  const deps = createFakeRenderApiDependencies(callLog, { fetchRemote });
  const runtime = createRenderApiRuntime(deps);
  return { deps, runtime };
}

describe('handleGetOpenRouterModels', () => {
  it('defaults to scope=all with recommended models first', async () => {
    const { deps, runtime } = await scenario();

    const response = await handleGetOpenRouterModels(deps, runtime, getRequest('/settings/producer/openrouter-models'));
    const body = response.body as OpenRouterModelsBody;

    expect(response.status).toBe(200);
    expect(body.models.length).toBe(18);
    expect(body.models[0]?.recommended).toBe(true);
    expect(body.stale).toBe(false);
    expect(typeof body.fetchedAt).toBe('string');
  });

  it('scope=recommended returns only the recommended models', async () => {
    const { deps, runtime } = await scenario();

    const response = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models?scope=recommended'),
    );
    const body = response.body as OpenRouterModelsBody;

    expect(body.models.map((model) => model.id)).toEqual([
      'anthropic/claude-haiku-4.5',
      'deepseek/deepseek-v4.1-flash',
    ]);
  });

  it('q filters by id or name, case-insensitively', async () => {
    const { deps, runtime } = await scenario();

    const response = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models?q=GEMINI'),
    );
    const body = response.body as OpenRouterModelsBody;

    expect(body.models.map((model) => model.id)).toEqual(['google/gemini-3.5-flash-lite']);
  });

  it('sort=price orders ascending by prompt price per million tokens', async () => {
    const { deps, runtime } = await scenario();

    const response = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models?sort=price'),
    );
    const body = response.body as OpenRouterModelsBody;

    const prices = body.models.map((model) => model.pricing.promptPerMTokUsd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('sort=name orders alphabetically by name', async () => {
    const { deps, runtime } = await scenario();

    const response = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models?sort=name'),
    );
    const body = response.body as OpenRouterModelsBody;

    const names = body.models.map((model) => model.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects an unknown scope with INVALID_INPUT', async () => {
    const { deps, runtime } = await scenario();

    const payload = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models?scope=bogus'),
    ).then(
      () => {
        throw new Error('expected the handler to reject');
      },
      (error: unknown) => toErrorPayload(error),
    );

    expect(payload.code).toBe('INVALID_INPUT');
  });

  it('propagates OPENROUTER_CATALOG_UNAVAILABLE when there is nothing cached and the fetch fails', async () => {
    const { deps, runtime } = await scenario(503);

    const payload = await handleGetOpenRouterModels(
      deps,
      runtime,
      getRequest('/settings/producer/openrouter-models'),
    ).then(
      () => {
        throw new Error('expected the handler to reject');
      },
      (error: unknown) => toErrorPayload(error),
    );

    expect(payload.code).toBe('OPENROUTER_CATALOG_UNAVAILABLE');
  });
});
