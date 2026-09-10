import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { JSON_CONTENT_TYPE } from '../http-message';
import { handleListVoices } from './voices-handler';
import type { VoicesBody } from './voices-handler';

class FakeBinaryNotFoundError extends Error {
  readonly code = 'BINARY_NOT_FOUND';
}

describe('handleListVoices (US-09-003)', () => {
  it('answers 200 with the installed voices and which one is the configured default', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const response = await handleListVoices(deps);
    const body = response.body as VoicesBody;

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(JSON_CONTENT_TYPE);
    expect(Object.keys(body).sort()).toEqual(['voices']);
    expect(body.voices.map((voice) => Object.keys(voice).sort())).toEqual([
      ['fileName', 'id', 'isDefault'],
      ['fileName', 'id', 'isDefault'],
    ]);
    expect(body.voices.filter((voice) => voice.isDefault).map((voice) => voice.id)).toEqual([
      'es_AR-daniela-high',
    ]);
  });

  it('answers 503 VOICE_MODEL_UNAVAILABLE instead of an empty list when Piper is not configured', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => {
        throw new FakeBinaryNotFoundError('piper-voice not found');
      },
    });

    await expect(handleListVoices(deps)).rejects.toMatchObject({
      code: 'VOICE_MODEL_UNAVAILABLE',
      resource: 'piper-voices',
    });
  });

  it('never leaks the resolved path of the voice directory into the error payload', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      listVoiceModels: async () => {
        throw new FakeBinaryNotFoundError('piper-voice not found at /home/dev/.cache/piper-voices');
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
