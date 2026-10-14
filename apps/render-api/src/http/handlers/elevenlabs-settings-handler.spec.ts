import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeFetchRemote, jsonBodyChunks } from '../../__fixtures__/fake-fetch-remote';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { toErrorPayload } from '../../errors/to-error-payload';
import {
  handleDeleteElevenLabsKey,
  handleGetElevenLabsSettings,
  handlePutElevenLabsKey,
  handlePutElevenLabsVoices,
} from './elevenlabs-settings-handler';
import { handleListVoices } from './voices-handler';
import type { VoicesBody } from './voices-handler';

const KEY = 'test-key-not-real';

function jsonChunks(value: unknown): AsyncGenerator<Uint8Array> {
  return (async function* generate() {
    yield new TextEncoder().encode(JSON.stringify(value));
  })();
}

function put(path: string, body: unknown) {
  return requestLine({ method: 'PUT', path, body: jsonChunks(body) });
}

describe('ElevenLabs settings handlers', () => {
  it('reports no key and the default Malena voice when nothing was configured', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const response = await handleGetElevenLabsSettings(deps);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body as object).sort()).toEqual(['keyConfigured', 'voices']);
    expect(response.body).toEqual({
      keyConfigured: false,
      voices: [
        {
          id: 'elevenlabs:p7AwDmKvTdoHTBuueGvP',
          label: 'Malena',
          description: 'Rioplatense, cálida y dinámica (ElevenLabs)',
        },
      ],
    });
  });

  it('validates the key against the subscription endpoint, stores it and answers the tier', async () => {
    const fake = createFakeFetchRemote({ status: 200, bodyChunks: jsonBodyChunks({ tier: 'creator' }) });
    const deps = createFakeRenderApiDependencies(createCallLog(), { fetchRemote: fake.fetchRemote });

    const response = await handlePutElevenLabsKey(deps, put('/settings/voice/elevenlabs-key', { key: KEY }));

    expect(Object.keys(response.body as object).sort()).toEqual(['keyConfigured', 'tier']);
    expect(response.body).toEqual({ keyConfigured: true, tier: 'creator' });
    expect(fake.calls[0]?.url).toBe('https://api.elevenlabs.io/v1/user/subscription');
    expect(fake.calls[0]?.init.headers).toEqual({ 'xi-api-key': KEY });
    expect(await deps.secretStore.get('elevenlabs')).toBe(KEY);
    expect(JSON.stringify(await handleGetElevenLabsSettings(deps))).not.toContain(KEY);
  });

  it('rejects a 401 key with a clear error and does not store it', async () => {
    const fake = createFakeFetchRemote({ status: 401 });
    const deps = createFakeRenderApiDependencies(createCallLog(), { fetchRemote: fake.fetchRemote });

    const error = await handlePutElevenLabsKey(deps, put('/settings/voice/elevenlabs-key', { key: KEY })).catch(
      (cause: unknown) => toErrorPayload(cause),
    );

    expect(error).toMatchObject({ code: 'VOICE_ENGINE_NOT_CONFIGURED' });
    expect(JSON.stringify(error)).toContain('no es válida');
    expect(await deps.secretStore.get('elevenlabs')).toBeNull();
  });

  it('deletes the key', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    await deps.secretStore.set('elevenlabs', KEY);

    const response = await handleDeleteElevenLabsKey(deps);

    expect(response.body).toEqual({ keyConfigured: false });
    expect(await deps.secretStore.get('elevenlabs')).toBeNull();
  });

  it('normalizes configured voice ids to the elevenlabs: prefix', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const response = await handlePutElevenLabsVoices(
      deps,
      put('/settings/voice/elevenlabs-voices', {
        voices: [
          { id: 'abc', label: 'Uno' },
          { id: 'elevenlabs:def', label: 'Dos', description: 'La segunda' },
        ],
      }),
    );

    expect(response.body).toEqual({
      keyConfigured: false,
      voices: [
        { id: 'elevenlabs:abc', label: 'Uno', description: '' },
        { id: 'elevenlabs:def', label: 'Dos', description: 'La segunda' },
      ],
    });
  });

  it('rejects voices without an id', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    await expect(
      handlePutElevenLabsVoices(deps, put('/settings/voice/elevenlabs-voices', { voices: [{ label: 'x' }] })),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('GET /voices with ElevenLabs', () => {
  it('lists ElevenLabs voices only when a key is stored, tagged with their engine', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const without = (await handleListVoices(deps)).body as VoicesBody;
    await deps.secretStore.set('elevenlabs', KEY);
    const withKey = (await handleListVoices(deps)).body as VoicesBody;

    expect(without.voices.every((voice) => voice.engine === 'piper')).toBe(true);
    const eleven = withKey.voices.filter((voice) => voice.engine === 'elevenlabs');
    expect(eleven).toHaveLength(1);
    expect(Object.keys(eleven[0] as object).sort()).toEqual([
      'description',
      'engine',
      'id',
      'isDefault',
      'label',
      'language',
      'previewUrl',
      'quality',
    ]);
    expect(eleven[0]).toMatchObject({
      id: 'elevenlabs:p7AwDmKvTdoHTBuueGvP',
      isDefault: false,
      language: { code: 'es', region: null },
      previewUrl: '/voices/elevenlabs%3Ap7AwDmKvTdoHTBuueGvP/preview',
    });
  });
});
