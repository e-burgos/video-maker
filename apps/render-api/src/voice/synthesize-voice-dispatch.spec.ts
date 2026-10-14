import { describe, expect, it } from 'vitest';

import type { SynthesizeVoiceInput } from '../deps/render-api-dependencies';
import { createVoiceSynthesisDispatcher } from './synthesize-voice-dispatch';
import { engineVoiceFields, resolveVoiceModel } from './voice-synthesis-steps';
import { voiceLanguageFromModelId } from './voice-language';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createCallLog } from '../__fixtures__/call-log';

const BASE: SynthesizeVoiceInput = { textPath: '/t.txt', outPath: '/o.wav', modelPath: '/m', projectRoot: '/p' };

describe('createVoiceSynthesisDispatcher', () => {
  it('routes elevenlabs: voice ids to ElevenLabs and everything else to Piper', async () => {
    const calls: string[] = [];
    const dispatch = createVoiceSynthesisDispatcher({
      piper: async () => {
        calls.push('piper');
      },
      elevenlabs: async () => {
        calls.push('elevenlabs');
      },
    });

    await dispatch(BASE);
    await dispatch({ ...BASE, voiceId: 'es_AR-daniela-high' });
    await dispatch({ ...BASE, voiceId: 'elevenlabs:abc' });

    expect(calls).toEqual(['piper', 'piper', 'elevenlabs']);
  });
});

describe('ElevenLabs voice resolution', () => {
  it('resolves an elevenlabs: voice without touching the Piper catalog', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => {
        throw new Error('must not list piper voices');
      },
    });

    const model = await resolveVoiceModel(deps, 'elevenlabs:abc');

    expect(model).toEqual({ id: 'elevenlabs:abc', path: '' });
  });

  it('uses an elevenlabs: brand voice and keeps the brand length scale when the key is configured', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());
    await deps.secretStore.set('elevenlabs', 'key');

    const model = await resolveVoiceModel(deps, null, { id: 'elevenlabs:abc', lengthScale: 1.1 });

    expect(model).toEqual({ id: 'elevenlabs:abc', path: '', lengthScale: 1.1 });
  });

  it('falls back to the default Piper voice when the brand voice is from ElevenLabs and there is no key', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const model = await resolveVoiceModel(deps, null, { id: 'elevenlabs:abc', lengthScale: 1.1 });

    expect(model.id).not.toMatch(/^elevenlabs:/);
  });

  it('keeps Piper voices without engine fields and defaults the ElevenLabs language to es', () => {
    expect(engineVoiceFields({ id: 'es_AR-daniela-high', path: '/x' }, 'es-AR')).toEqual({});
    expect(engineVoiceFields({ id: 'elevenlabs:abc', path: '' }, 'es-AR')).toEqual({
      voiceId: 'elevenlabs:abc',
      languageCode: 'es',
    });
    expect(voiceLanguageFromModelId('elevenlabs:abc')).toBe('es');
  });
});
