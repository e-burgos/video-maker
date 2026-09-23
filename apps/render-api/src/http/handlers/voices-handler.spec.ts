import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { JSON_CONTENT_TYPE } from '../http-message';
import { handleListVoices } from './voices-handler';
import type { VoicesBody } from './voices-handler';

class FakeBinaryNotFoundError extends Error {
  readonly code = 'BINARY_NOT_FOUND';
}

describe('handleListVoices (US-09-003, US-016-001)', () => {
  it('answers 200 with the installed voices and which one is the configured default', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const response = await handleListVoices(deps);
    const body = response.body as VoicesBody;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(Object.keys(body).sort()).toEqual(['voices']);
    expect(body.voices.map((voice) => Object.keys(voice).sort())).toEqual([
      [
        'description',
        'directory',
        'fileName',
        'id',
        'isDefault',
        'label',
        'language',
        'previewUrl',
        'quality',
      ],
      [
        'description',
        'directory',
        'fileName',
        'id',
        'isDefault',
        'label',
        'language',
        'previewUrl',
        'quality',
      ],
    ]);
    expect(body.voices.filter((voice) => voice.isDefault).map((voice) => voice.id)).toEqual([
      'es_AR-daniela-high',
    ]);
  });

  it('publishes the readable label, the language and the quality the studio needs to choose a voice', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const body = (await handleListVoices(deps)).body as VoicesBody;
    const [daniela] = body.voices;

    expect(daniela?.label).toBe('Daniela \u00b7 Spanish (Argentina) \u00b7 High quality');
    expect(daniela?.language).toEqual({ code: 'es-AR', region: 'AR' });
    expect(daniela?.quality).toBe('high');
    expect(daniela?.description).toContain('Spanish as spoken in Argentina');
  });

  it('adds a previewUrl per voice that is a path of this service, never an absolute url', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const body = (await handleListVoices(deps)).body as VoicesBody;

    expect(body.voices.map((voice) => voice.previewUrl)).toEqual([
      '/voices/es_AR-daniela-high/preview',
      '/voices/es_ES-sharvard-medium/preview',
    ]);
    expect(body.voices.every((voice) => !voice.previewUrl.includes('://'))).toBe(true);
  });

  it('answers 503 VOICE_MODEL_UNAVAILABLE instead of an empty list when the voice engine is not configured', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => {
        throw new FakeBinaryNotFoundError('tts-voices not found');
      },
    });

    await expect(handleListVoices(deps)).rejects.toMatchObject({
      code: 'VOICE_MODEL_UNAVAILABLE',
      resource: 'tts-voices',
    });
  });

  it('never leaks the resolved path of the voice directory into the error payload', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => {
        throw new FakeBinaryNotFoundError('tts-voices not found at /home/dev/.cache/tts-voices');
      },
    });

    const error = await handleListVoices(deps).catch((cause: unknown) => cause);

    expect(JSON.stringify(error)).not.toContain('/home/dev/.cache');
  });

  it('answers 200 with an empty list when the directory has no onnx model', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => [],
    });

    const response = await handleListVoices(deps);

    expect(response.status).toBe(200);
    expect((response.body as VoicesBody).voices).toEqual([]);
  });
});
