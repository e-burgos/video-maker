import { describe, expect, it } from 'vitest';

import { buildTranscriptionKey } from './transcription-key';
import type { TranscriptionKeyInput } from './transcription-key';

function baseInput(overrides: Partial<TranscriptionKeyInput> = {}): TranscriptionKeyInput {
  return {
    assetId: 'raw/aroll/clip01.mp4',
    sizeBytes: 1_048_576,
    modifiedAtMs: 1_700_000_000_000,
    engine: 'whisper.cpp',
    model: 'ggml-base.bin',
    language: 'es',
    ...overrides,
  };
}

describe('buildTranscriptionKey', () => {
  it('la misma entrada produce siempre la misma clave', () => {
    expect(buildTranscriptionKey(baseInput())).toBe(buildTranscriptionKey(baseInput()));
  });

  it('cambia si cambia sizeBytes', () => {
    expect(buildTranscriptionKey(baseInput({ sizeBytes: 2_048 }))).not.toBe(
      buildTranscriptionKey(baseInput()),
    );
  });

  it('cambia si cambia modifiedAtMs', () => {
    expect(buildTranscriptionKey(baseInput({ modifiedAtMs: 1_700_000_000_001 }))).not.toBe(
      buildTranscriptionKey(baseInput()),
    );
  });

  it('cambia si cambia el modelo, aunque el resto sea idéntico (el bug silencioso a evitar)', () => {
    expect(buildTranscriptionKey(baseInput({ model: 'ggml-large-v3-turbo-q5_0.bin' }))).not.toBe(
      buildTranscriptionKey(baseInput()),
    );
  });

  it('cambia si cambia el idioma', () => {
    expect(buildTranscriptionKey(baseInput({ language: 'en' }))).not.toBe(
      buildTranscriptionKey(baseInput()),
    );
  });

  it('cambia si cambia el engine', () => {
    expect(buildTranscriptionKey(baseInput({ engine: 'faster-whisper' }))).not.toBe(
      buildTranscriptionKey(baseInput()),
    );
  });

  it('dos assets distintos con el mismo tamaño y mtime producen claves distintas', () => {
    const clave1 = buildTranscriptionKey(baseInput({ assetId: 'raw/aroll/clip01.mp4' }));
    const clave2 = buildTranscriptionKey(baseInput({ assetId: 'raw/broll/clip01.mp4' }));

    expect(clave1).not.toBe(clave2);
  });
});
