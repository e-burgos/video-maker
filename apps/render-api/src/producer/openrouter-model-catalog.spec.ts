import { describe, expect, it } from 'vitest';

import { createFakeFetchRemote, jsonBodyChunks } from '../__fixtures__/fake-fetch-remote';
import { OPENROUTER_MODELS_SAMPLE_PAYLOAD } from '../__fixtures__/openrouter-models-sample';
import { toErrorPayload } from '../errors/to-error-payload';
import {
  OPENROUTER_MODELS_URL,
  createOpenRouterModelCatalog,
  fetchOpenRouterModelCatalog,
} from './openrouter-model-catalog';

const NOW_MS = Date.parse('2026-09-24T00:00:00.000Z');

describe('fetchOpenRouterModelCatalog', () => {
  it('keeps only tool-capable models and maps pricing to per-million USD', async () => {
    const { fetchRemote, calls } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    const models = await fetchOpenRouterModelCatalog(fetchRemote);

    expect(calls[0]?.url).toBe(OPENROUTER_MODELS_URL);
    expect(models.length).toBe(17);
    expect(models.some((model) => model.id === 'inference-net/schematron-v2-turbo')).toBe(false);
    expect(models.some((model) => model.id === 'tencent/hy-mt2-1.8b')).toBe(false);

    const haiku = models.find((model) => model.id === 'anthropic/claude-haiku-4.5');
    expect(haiku).toMatchObject({
      name: 'Anthropic: Claude Haiku 4.5',
      contextLength: 200000,
      pricing: { promptPerMTokUsd: 1, completionPerMTokUsd: 5 },
      supportsImages: true,
      isFree: false,
      recommended: true,
    });
    expect(haiku?.recommendation?.tier).toBe('reference');
  });

  it('flags a :free suffixed model and a zero-priced model without the suffix as free', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    const models = await fetchOpenRouterModelCatalog(fetchRemote);

    const suffixedFree = models.find((model) => model.id === 'nex-agi/nex-n2.5-mini:free');
    expect(suffixedFree?.isFree).toBe(true);

    const zeroPricedFree = models.find((model) => model.id === 'stealth/space-bunny-alpha');
    expect(zeroPricedFree?.isFree).toBe(true);

    const paid = models.find((model) => model.id === 'openai/gpt-4o-mini');
    expect(paid?.isFree).toBe(false);
  });

  it('marks unrecommended models as not recommended with no recommendation metadata', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    const models = await fetchOpenRouterModelCatalog(fetchRemote);

    const notRecommended = models.find((model) => model.id === 'fireworks/ember-1');
    expect(notRecommended?.recommended).toBe(false);
    expect(notRecommended?.recommendation).toBeNull();
  });

  it('sorts recommended models first', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    const models = await fetchOpenRouterModelCatalog(fetchRemote);
    const firstNonRecommendedIndex = models.findIndex((model) => !model.recommended);
    const lastRecommendedIndex = models.map((model) => model.recommended).lastIndexOf(true);

    expect(lastRecommendedIndex).toBeLessThan(firstNonRecommendedIndex);
  });

  it('raises OPENROUTER_CATALOG_UNAVAILABLE on a non-200 status', async () => {
    const { fetchRemote } = createFakeFetchRemote({ status: 503 });

    const payload = await fetchOpenRouterModelCatalog(fetchRemote).then(
      () => {
        throw new Error('expected the fetch to reject');
      },
      (error: unknown) => toErrorPayload(error),
    );

    expect(payload.code).toBe('OPENROUTER_CATALOG_UNAVAILABLE');
  });

  it('raises OPENROUTER_CATALOG_UNAVAILABLE on an unexpected payload shape', async () => {
    const { fetchRemote } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks({ notData: [] }),
    });

    const payload = await fetchOpenRouterModelCatalog(fetchRemote).then(
      () => {
        throw new Error('expected the fetch to reject');
      },
      (error: unknown) => toErrorPayload(error),
    );

    expect(payload.code).toBe('OPENROUTER_CATALOG_UNAVAILABLE');
  });
});

describe('createOpenRouterModelCatalog', () => {
  it('serves the cached catalog within the ttl without calling fetchRemote again', async () => {
    const catalog = createOpenRouterModelCatalog(60 * 60 * 1000);
    const { fetchRemote, calls } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    const first = await catalog.load(fetchRemote, NOW_MS);
    const second = await catalog.load(fetchRemote, NOW_MS + 1000);

    expect(calls.length).toBe(1);
    expect(first.stale).toBe(false);
    expect(second.stale).toBe(false);
    expect(second.models).toBe(first.models);
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it('refetches once the ttl has elapsed', async () => {
    const catalog = createOpenRouterModelCatalog(1000);
    const { fetchRemote, calls } = createFakeFetchRemote({
      status: 200,
      bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD),
    });

    await catalog.load(fetchRemote, NOW_MS);
    await catalog.load(fetchRemote, NOW_MS + 2000);

    expect(calls.length).toBe(2);
  });

  it('serves the stale cached catalog when a refetch fails', async () => {
    const catalog = createOpenRouterModelCatalog(1000);
    const ok = createFakeFetchRemote({ status: 200, bodyChunks: jsonBodyChunks(OPENROUTER_MODELS_SAMPLE_PAYLOAD) });
    await catalog.load(ok.fetchRemote, NOW_MS);

    const failing = createFakeFetchRemote({ status: 503 });
    const second = await catalog.load(failing.fetchRemote, NOW_MS + 2000);

    expect(second.stale).toBe(true);
    expect(second.models.length).toBeGreaterThan(0);
  });

  it('throws OPENROUTER_CATALOG_UNAVAILABLE when there is nothing cached and the fetch fails', async () => {
    const catalog = createOpenRouterModelCatalog(1000);
    const { fetchRemote } = createFakeFetchRemote({ status: 503 });

    const payload = await catalog.load(fetchRemote, NOW_MS).then(
      () => {
        throw new Error('expected the load to reject');
      },
      (error: unknown) => toErrorPayload(error),
    );

    expect(payload.code).toBe('OPENROUTER_CATALOG_UNAVAILABLE');
  });
});
