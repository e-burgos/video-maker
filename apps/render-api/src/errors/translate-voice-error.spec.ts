import { describe, expect, it } from 'vitest';

import { httpStatusFor } from './http-status-for';
import { PipelineStageError } from './pipeline-stage-error';
import { translateVoiceError } from './translate-voice-error';

class FakeMediaLocalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

describe('translateVoiceError (US-09-002, US-09-004)', () => {
  it('deja pasar un error propio sin reenvolverlo ni cambiarle la etapa', () => {
    const own = new PipelineStageError({ code: 'STORYBOARD_NOT_FOUND', stage: null, resource: 'work/storyboard.json' });

    expect(translateVoiceError(own, 'synthesize', 'scene-01')).toBe(own);
  });

  it('traduce BINARY_NOT_FOUND a VOICE_MODEL_UNAVAILABLE con la pista de las env vars', () => {
    const error = translateVoiceError(
      new FakeMediaLocalError('BINARY_NOT_FOUND', 'tts-voices not found'),
      'synthesize',
      'scene-01',
    );

    expect(error.code).toBe('VOICE_MODEL_UNAVAILABLE');
    expect(httpStatusFor(error.code)).toBe(503);
    expect(error.hint).toContain('TTS_VOICES_DIR');
    expect(error.stage).toBe('synthesize');
  });

  it('un fallo del binario en synthesize es VOICE_SYNTHESIS_FAILED', () => {
    const error = translateVoiceError(
      new FakeMediaLocalError('COMMAND_FAILED', 'sherpa-onnx-offline-tts exited with 1'),
      'synthesize',
      'scene-02',
    );

    expect(error.code).toBe('VOICE_SYNTHESIS_FAILED');
    expect(httpStatusFor(error.code)).toBe(500);
    expect(error.resource).toBe('scene-02');
  });

  it('un fallo del binario en transcribe es VOICE_TRANSCRIPTION_FAILED', () => {
    const error = translateVoiceError(
      new FakeMediaLocalError('UNPARSEABLE_OUTPUT', 'whisper wrote no json'),
      'transcribe',
      'scene-03',
    );

    expect(error.code).toBe('VOICE_TRANSCRIPTION_FAILED');
    expect(httpStatusFor(error.code)).toBe(500);
  });

  it('un fallo inesperado al persistir es INTERNAL_ERROR y no un código de voz', () => {
    const error = translateVoiceError(new Error('disk full'), 'persist', 'work/voice/manifest.json');

    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('sin etapa, cualquier fallo que no sea de binario es INTERNAL_ERROR', () => {
    const error = translateVoiceError(new Error('ENOENT'), null, 'tts-voices');

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.stage).toBeNull();
  });

  it('un valor que no es objeto no rompe la traducción', () => {
    expect(translateVoiceError('boom', 'synthesize', null).code).toBe('VOICE_SYNTHESIS_FAILED');
    expect(translateVoiceError(null, 'synthesize', null).code).toBe('VOICE_SYNTHESIS_FAILED');
  });
});
