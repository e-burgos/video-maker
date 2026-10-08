import { resolveMediaProject } from '@video-maker/auto-montage';
import type { Transcription } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import {
  mergeVoiceScriptLineWords,
  transcribeVoiceScriptLine,
} from './transcribe-voice-script-lines';
import type { VoiceScriptLineWindow } from './transcribe-voice-script-lines';

const PROJECT = resolveMediaProject('/var/data/media/acme-launch');

const WINDOW: VoiceScriptLineWindow = {
  lineId: 'line-02',
  text: 'Las campañas viven acá',
  path: 'work/voice/sources/line-02.wav',
  startMs: 20_000,
  endMs: 25_689,
};

function transcription(words: Transcription['words']): Transcription {
  return {
    assetId: 'work/voice/sources/line-02.wav',
    engine: 'whisper.cpp',
    model: 'ggml-large-v3-turbo.bin',
    language: 'es',
    words,
    segments: [],
  };
}

function deps(overrides?: Partial<RenderApiDependencies>): RenderApiDependencies {
  const callLog = createCallLog();
  return createFakeRenderApiDependencies(callLog, {
    storage: createFakeObjectStorage(callLog, { directories: [PROJECT.root] }),
    ...overrides,
  });
}

describe('transcribeVoiceScriptLine', () => {
  it('desplaza las palabras de la frase por el startMs de su línea', async () => {
    const result = await transcribeVoiceScriptLine(
      WINDOW,
      'es-AR',
      deps({
        transcribeVoice: async () =>
          transcription([
            { text: 'Las', startMs: 0, endMs: 400 },
            { text: 'campañas', startMs: 400, endMs: 1200 },
          ]),
      }),
      PROJECT,
    );

    expect(result.source).toBe('whisper');
    expect(result.words.slice(0, 1)).toEqual([{ text: 'Las', startMs: 20_000, endMs: 20_400 }]);
    expect(result.words.map((word) => word.text)).toEqual(['Las', 'campañas', 'viven', 'acá']);
    expect(result.words[result.words.length - 1]?.endMs).toBe(21_200);
  });

  it('acota la última palabra al fin real del audio de la frase, no al inicio de la siguiente', async () => {
    const result = await transcribeVoiceScriptLine(
      WINDOW,
      'es-AR',
      deps({
        transcribeVoice: async () =>
          transcription([
            { text: 'Las', startMs: 0, endMs: 400 },
            { text: 'acá', startMs: 400, endMs: 14_000 },
          ]),
      }),
      PROJECT,
    );

    expect(result.words[result.words.length - 1]).toMatchObject({ text: 'acá', endMs: 25_689 });
  });

  it('descarta una palabra que quedaría entera fuera de la ventana', async () => {
    const result = await transcribeVoiceScriptLine(
      WINDOW,
      'es-AR',
      deps({
        transcribeVoice: async () =>
          transcription([
            { text: 'Las', startMs: 0, endMs: 400 },
            { text: 'sobra', startMs: 6000, endMs: 7000 },
          ]),
      }),
      PROJECT,
    );

    expect(result.words.map((word) => word.text)).toEqual(['Las', 'campañas', 'viven', 'acá']);
    expect(result.words.every((word) => word.endMs <= 20_400)).toBe(true);
  });

  it('reparte el guion de la línea dentro de su ventana cuando Whisper falla', async () => {
    const result = await transcribeVoiceScriptLine(
      WINDOW,
      'es-AR',
      deps({
        transcribeVoice: async () => {
          throw new Error('whisper-cli exited with 1');
        },
      }),
      PROJECT,
    );

    expect(result.source).toBe('script');
    expect(result.words).toEqual([
      { text: 'Las', startMs: 20_000, endMs: 21_422 },
      { text: 'campañas', startMs: 21_422, endMs: 22_845 },
      { text: 'viven', startMs: 22_845, endMs: 24_267 },
      { text: 'acá', startMs: 24_267, endMs: 25_689 },
    ]);
  });

  it('reparte el guion cuando Whisper no devuelve ninguna palabra dentro de la ventana', async () => {
    const result = await transcribeVoiceScriptLine(
      WINDOW,
      'es-AR',
      deps({ transcribeVoice: async () => transcription([]) }),
      PROJECT,
    );

    expect(result.source).toBe('script');
    expect(result.words).toHaveLength(4);
  });
});

describe('mergeVoiceScriptLineWords', () => {
  it('une las palabras en orden y deja los segmentos vacíos', () => {
    const merged = mergeVoiceScriptLineWords('work/voice/voice.wav', 'es', [
      {
        words: [{ text: 'uno', startMs: 0, endMs: 400 }],
        source: 'whisper',
        transcription: transcription([]),
      },
      {
        words: [{ text: 'dos', startMs: 20_000, endMs: 20_400 }],
        source: 'script',
        transcription: null,
      },
    ]);

    expect(merged).toEqual({
      assetId: 'work/voice/voice.wav',
      engine: 'whisper.cpp',
      model: 'ggml-large-v3-turbo.bin',
      language: 'es',
      words: [
        { text: 'uno', startMs: 0, endMs: 400 },
        { text: 'dos', startMs: 20_000, endMs: 20_400 },
      ],
      segments: [],
    });
  });

  it('cae al idioma de whisper del pipeline cuando ninguna línea se pudo transcribir', () => {
    const merged = mergeVoiceScriptLineWords('work/voice/voice.wav', 'es', [
      { words: [{ text: 'uno', startMs: 0, endMs: 400 }], source: 'script', transcription: null },
    ]);

    expect(merged.language).toBe('es');
    expect(merged.model).toBeUndefined();
  });
});
