import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeFetchRemote } from '../../__fixtures__/fake-fetch-remote';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { createRecordingLogger } from '../../__fixtures__/recording-logger';
import { requestLine } from '../../__fixtures__/http-request';
import { toErrorPayload } from '../../errors/to-error-payload';
import { createRenderApiRuntime } from '../render-api-runtime';
import {
  handleDeleteOpenRouterKey,
  handleGetProducerSettings,
  handlePutOpenRouterKey,
  handlePutProducerSettings,
  resolveEffectiveProducerEngine,
} from './producer-settings-handler';

const FAKE_KEY = 'sk-or-v1-test-0000';

function jsonChunks(value: unknown): AsyncGenerator<Uint8Array> {
  return (async function* generate() {
    yield new TextEncoder().encode(JSON.stringify(value));
  })();
}

function putProducerSettingsRequest(body: unknown) {
  return requestLine({ method: 'PUT', path: '/settings/producer', body: jsonChunks(body) });
}

function putOpenRouterKeyRequest(body: unknown) {
  return requestLine({
    method: 'PUT',
    path: '/settings/producer/openrouter-key',
    body: jsonChunks(body),
  });
}

async function caughtErrorPayload(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('resolveEffectiveProducerEngine', () => {
  it('honors an explicit engine choice even when it is not the auto default', () => {
    expect(resolveEffectiveProducerEngine('openrouter', true, false)).toBe('openrouter');
  });

  it('defaults to claude-cli when it is available', () => {
    expect(resolveEffectiveProducerEngine(null, true, true)).toBe('claude-cli');
  });

  it('falls back to openrouter when claude is unavailable but a key is present', () => {
    expect(resolveEffectiveProducerEngine(null, false, true)).toBe('openrouter');
  });

  it('is null when neither engine is usable', () => {
    expect(resolveEffectiveProducerEngine(null, false, false)).toBeNull();
  });
});

describe('handleGetProducerSettings', () => {
  it('reports no key and the claude default when nothing was configured', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, { probeProducerBinary: async () => true });
    const runtime = createRenderApiRuntime(deps);

    const response = await handleGetProducerSettings(deps, runtime);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      engine: null,
      effectiveEngine: 'claude-cli',
      engines: {
        claudeCli: { available: true, reason: null },
        openrouter: { keyPresent: false, keyHint: null },
      },
      models: { claude: null, openrouter: null },
    });
  });

  it('reports the stored key hint without ever including the key itself', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, { probeProducerBinary: async () => false });
    const runtime = createRenderApiRuntime(deps);
    await deps.secretStore.set('openrouter', FAKE_KEY);

    const response = await handleGetProducerSettings(deps, runtime);

    expect(response.body).toMatchObject({
      effectiveEngine: 'openrouter',
      engines: { openrouter: { keyPresent: true, keyHint: '0000' } },
    });
    expect(JSON.stringify(response.body)).not.toContain(FAKE_KEY);
  });
});

describe('handlePutProducerSettings', () => {
  it('persists the chosen engine and rejects an unknown claude model', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog, { probeProducerBinary: async () => true });
    const runtime = createRenderApiRuntime(deps);

    const ok = await handlePutProducerSettings(
      deps,
      runtime,
      putProducerSettingsRequest({ engine: 'openrouter' }),
    );
    expect(ok.status).toBe(200);
    expect((ok.body as { engine: unknown }).engine).toBe('openrouter');

    const payload = await caughtErrorPayload(
      handlePutProducerSettings(
        deps,
        runtime,
        putProducerSettingsRequest({ models: { claude: 'not-a-real-model' } }),
      ),
    );
    expect(payload.code).toBe('PRODUCER_MODEL_INVALID');
  });

  it('rejects an openrouter model outside the curated list', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    const runtime = createRenderApiRuntime(deps);

    const payload = await caughtErrorPayload(
      handlePutProducerSettings(
        deps,
        runtime,
        putProducerSettingsRequest({ models: { openrouter: 'not-curated/anything' } }),
      ),
    );
    expect(payload.code).toBe('PRODUCER_MODEL_INVALID');
  });
});

describe('handlePutOpenRouterKey', () => {
  it('rejects a badly formatted key without calling OpenRouter', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const payload = await caughtErrorPayload(
      handlePutOpenRouterKey(deps, putOpenRouterKeyRequest({ apiKey: 'not-a-key' })),
    );
    expect(payload.code).toBe('OPENROUTER_KEY_INVALID');
    expect(callLog.ports()).not.toContain('fetchRemote');
  });

  it('stores the key and returns only its last 4 characters when verify is skipped', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);

    const response = await handlePutOpenRouterKey(
      deps,
      putOpenRouterKeyRequest({ apiKey: FAKE_KEY, verify: false }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ keyPresent: true, keyHint: '0000' });
    await expect(deps.secretStore.get('openrouter')).resolves.toBe(FAKE_KEY);
  });

  it('verifies the key against OpenRouter before storing it', async () => {
    const callLog = createCallLog();
    const { fetchRemote, calls } = createFakeFetchRemote({ status: 200 });
    const deps = createFakeRenderApiDependencies(callLog, { fetchRemote });

    const response = await handlePutOpenRouterKey(deps, putOpenRouterKeyRequest({ apiKey: FAKE_KEY }));

    expect(response.status).toBe(200);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/key');
    expect(calls[0]?.init.headers?.authorization).toBe(`Bearer ${FAKE_KEY}`);
  });

  it('maps a 401 from OpenRouter to OPENROUTER_KEY_INVALID and never stores the key', async () => {
    const callLog = createCallLog();
    const { fetchRemote } = createFakeFetchRemote({ status: 401 });
    const deps = createFakeRenderApiDependencies(callLog, { fetchRemote });

    const payload = await caughtErrorPayload(
      handlePutOpenRouterKey(deps, putOpenRouterKeyRequest({ apiKey: FAKE_KEY })),
    );

    expect(payload.code).toBe('OPENROUTER_KEY_INVALID');
    await expect(deps.secretStore.get('openrouter')).resolves.toBeNull();
  });

  it('never logs the request body', async () => {
    const callLog = createCallLog();
    const logger = createRecordingLogger();
    const deps = createFakeRenderApiDependencies(callLog, { logger });

    await handlePutOpenRouterKey(deps, putOpenRouterKeyRequest({ apiKey: FAKE_KEY, verify: false }));

    const serializedEvents = JSON.stringify(logger.events());
    expect(serializedEvents).not.toContain(FAKE_KEY);
  });
});

describe('handleDeleteOpenRouterKey', () => {
  it('removes the stored key', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    await deps.secretStore.set('openrouter', FAKE_KEY);

    const response = await handleDeleteOpenRouterKey(deps);

    expect(response.body).toEqual({ keyPresent: false, keyHint: null });
    await expect(deps.secretStore.get('openrouter')).resolves.toBeNull();
  });
});
