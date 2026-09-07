import { describe, expect, it } from 'vitest';

import { TranscriptionSchema } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { buildTranscription } from './build-transcription';
import { groupTokensIntoWords, parseWhisperCppJson } from './parse-whisper-cpp-json';
import { parseFasterWhisperJson } from './parse-faster-whisper-json';

const ASSET_ID = 'voice-take-01';
const MAX_WORD_TIMING_DRIFT_MS = 20;

const whisperCppRaw = readFixture('whisper/whisper-cpp.json');
const fasterWhisperRaw = readFixture('whisper/faster-whisper.json');

describe('groupTokensIntoWords', () => {
  it('agrupa tokens fragmentados por el espacio inicial', () => {
    const words = groupTokensIntoWords([
      { offsets: { from: 0, to: 0 }, text: '[_BEG_]' },
      { offsets: { from: 520, to: 700 }, text: ' mues' },
      { offsets: { from: 700, to: 900 }, text: 'tro' },
    ]);

    expect(words).toEqual([{ text: 'muestro', startMs: 520, endMs: 900 }]);
  });

  it('pega la puntuación a la palabra anterior', () => {
    const words = groupTokensIntoWords([
      { offsets: { from: 3120, to: 3620 }, text: ' completo' },
      { offsets: { from: 3620, to: 3700 }, text: '.' },
    ]);

    expect(words).toEqual([{ text: 'completo.', startMs: 3120, endMs: 3700 }]);
  });

  it('descarta tokens especiales sin abrir ni cerrar palabra', () => {
    const words = groupTokensIntoWords([
      { offsets: { from: 0, to: 300 }, text: ' Hoy' },
      { offsets: { from: 300, to: 300 }, text: '[_TT_350]' },
      { offsets: { from: 350, to: 500 }, text: ' te' },
    ]);

    expect(words.map((word) => word.text)).toEqual(['Hoy', 'te']);
  });

  it('el primer token de contenido siempre abre palabra aunque no traiga espacio inicial', () => {
    const words = groupTokensIntoWords([{ offsets: { from: 0, to: 300 }, text: 'Hoy' }]);

    expect(words).toEqual([{ text: 'Hoy', startMs: 0, endMs: 300 }]);
  });
});

describe('parseWhisperCppJson', () => {
  it('produce 8 palabras sin fragmentos a partir de 12 tokens', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(transcription.words).toHaveLength(8);
    expect(transcription.words.map((word) => word.text)).toEqual([
      'Hoy',
      'te',
      'muestro',
      'cómo',
      'editar',
      'un',
      'video',
      'completo.',
    ]);
    expect(transcription.words.some((word) => word.text === 'mues' || word.text === 'tro')).toBe(false);
    expect(transcription.engine).toBe('whisper.cpp');
  });

  it('descarta el token especial [_BEG_] y la primera palabra abre en 0', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(transcription.words[0]?.text).toBe('Hoy');
    expect(transcription.words[0]?.startMs).toBe(0);
  });

  it('resuelve language y model desde params/result del JSON', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(transcription.language).toBe('es');
    expect(transcription.model).toBe('ggml-large-v3-turbo.bin');
  });

  it('emite un único segmento cuyo wordRange cubre todas las palabras', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(transcription.segments).toHaveLength(1);
    expect(transcription.segments[0]?.wordRange).toEqual([0, 7]);
    expect(transcription.segments[0]?.startMs).toBe(0);
    expect(transcription.segments[0]?.endMs).toBe(3700);
    expect(transcription.segments[0]?.text).toBe('Hoy te muestro cómo editar un video completo.');
  });

  it('ninguna palabra tiene confidence: -oj no reporta probabilidad por token', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(transcription.words.every((word) => word.confidence === undefined)).toBe(true);
  });

  it('valida contra TranscriptionSchema', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID);

    expect(TranscriptionSchema.safeParse(transcription).success).toBe(true);
  });

  it('lanza UnparseableOutputError con JSON corrupto', () => {
    expect(() => parseWhisperCppJson('no soy json', ASSET_ID)).toThrow(UnparseableOutputError);
  });

  it('produce cero palabras y cero segmentos cuando la transcripción solo trae tokens especiales', () => {
    const raw = JSON.stringify({
      transcription: [{ offsets: { from: 0, to: 0 }, text: '[_BEG_]' }],
      params: { model: '/models/ggml-large-v3-turbo.bin', language: 'es' },
      result: { language: 'es' },
    });

    const transcription = parseWhisperCppJson(raw, ASSET_ID);

    expect(transcription.words).toEqual([]);
    expect(transcription.segments).toEqual([]);
  });

  it('lanza UnparseableOutputError sin campo transcription', () => {
    try {
      parseWhisperCppJson(fasterWhisperRaw, ASSET_ID);
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(UnparseableOutputError);
      expect((error as UnparseableOutputError).command).toBe('whisper.cpp');
    }
  });

  it('respeta un override explícito de language y model', () => {
    const transcription = parseWhisperCppJson(whisperCppRaw, ASSET_ID, {
      language: 'en',
      model: 'custom-model.bin',
    });

    expect(transcription.language).toBe('en');
    expect(transcription.model).toBe('custom-model.bin');
  });

  it('cae a params.language cuando result.language no está presente', () => {
    const raw = JSON.stringify({
      transcription: [{ offsets: { from: 0, to: 300 }, text: 'Hoy' }],
      params: { model: '/models/ggml-large-v3-turbo.bin', language: 'en' },
    });

    const transcription = parseWhisperCppJson(raw, ASSET_ID);

    expect(transcription.language).toBe('en');
  });

  it('usa el idioma default y omite model cuando el JSON no declara ninguno', () => {
    const raw = JSON.stringify({ transcription: [{ offsets: { from: 0, to: 300 }, text: 'Hoy' }] });

    const transcription = parseWhisperCppJson(raw, ASSET_ID);

    expect(transcription.language).toBe('es');
    expect(transcription.model).toBeUndefined();
  });
});

describe('parseFasterWhisperJson', () => {
  it('produce 8 palabras con confidence a partir del MISMO audio', () => {
    const transcription = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID);

    expect(transcription.words).toHaveLength(8);
    expect(transcription.words.map((word) => word.text)).toEqual([
      'Hoy',
      'te',
      'muestro',
      'cómo',
      'editar',
      'un',
      'video',
      'completo.',
    ]);
    expect(transcription.words[0]?.confidence).toBe(0.982);
    expect(transcription.engine).toBe('faster-whisper');
  });

  it('emite un segmento por entrada de segments[]', () => {
    const transcription = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID);

    expect(transcription.segments).toHaveLength(1);
    expect(transcription.segments[0]?.wordRange).toEqual([0, 7]);
    expect(transcription.segments[0]?.text).toBe('Hoy te muestro cómo editar un video completo.');
  });

  it('valida contra TranscriptionSchema', () => {
    const transcription = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID);

    expect(TranscriptionSchema.safeParse(transcription).success).toBe(true);
  });

  it('lanza UnparseableOutputError con JSON corrupto', () => {
    expect(() => parseFasterWhisperJson('no soy json', ASSET_ID)).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando el JSON es válido pero no matchea el schema', () => {
    expect(() => parseFasterWhisperJson('{"language":"es"}', ASSET_ID)).toThrow(UnparseableOutputError);
  });

  it('descarta palabras vacías tras el trim y omite el segmento que se queda sin ninguna', () => {
    const raw = JSON.stringify({
      segments: [
        { text: 'vacío', words: [{ word: '   ', start: 0, end: 0.1 }] },
        { start: 0.5, end: 1, words: [{ word: 'Hola', start: 0.5, end: 1 }] },
      ],
    });

    const transcription = parseFasterWhisperJson(raw, ASSET_ID);

    expect(transcription.words.map((word) => word.text)).toEqual(['Hola']);
    expect(transcription.segments).toHaveLength(1);
    expect(transcription.segments[0]?.wordRange).toEqual([0, 0]);
  });

  it('usa startMs/endMs de la palabra y el texto unido cuando el segmento no los declara', () => {
    const raw = JSON.stringify({
      segments: [{ words: [{ word: 'Hola', start: 0.5, end: 1 }, { word: 'mundo', start: 1, end: 1.4 }] }],
    });

    const transcription = parseFasterWhisperJson(raw, ASSET_ID);

    expect(transcription.segments[0]?.startMs).toBe(500);
    expect(transcription.segments[0]?.endMs).toBe(1400);
    expect(transcription.segments[0]?.text).toBe('Hola mundo');
  });

  it('no reporta confidence cuando la palabra no trae probability', () => {
    const raw = JSON.stringify({ segments: [{ words: [{ word: 'Hola', start: 0, end: 0.3 }] }] });

    const transcription = parseFasterWhisperJson(raw, ASSET_ID);

    expect(transcription.words[0]?.confidence).toBeUndefined();
  });

  it('usa el idioma default y omite model cuando el JSON no los declara', () => {
    const raw = JSON.stringify({ segments: [{ words: [{ word: 'Hola', start: 0, end: 0.3 }] }] });

    const transcription = parseFasterWhisperJson(raw, ASSET_ID);

    expect(transcription.language).toBe('es');
    expect(transcription.model).toBeUndefined();
  });

  it('respeta un override explícito de language y model sobre lo que trae el JSON', () => {
    const transcription = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID, {
      language: 'en',
      model: 'custom-model.bin',
    });

    expect(transcription.language).toBe('en');
    expect(transcription.model).toBe('custom-model.bin');
  });

  it('normalizeTranscriptionWords es un no-op: ninguna palabra se solapa con la siguiente', () => {
    const transcription = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID);
    const rawWords = JSON.parse(fasterWhisperRaw) as {
      segments: { words: { start: number; end: number }[] }[];
    };
    const expectedEndMs = rawWords.segments[0]?.words.map((word) => Math.round(word.end * 1000));

    expect(transcription.words.map((word) => word.endMs)).toEqual(expectedEndMs);
  });
});

describe('CA-019 — equivalencia entre whisper.cpp y faster-whisper', () => {
  it('misma cantidad de palabras y diferencia de tiempo por palabra <= 20 ms', () => {
    const cpp = parseWhisperCppJson(whisperCppRaw, ASSET_ID);
    const fasterWhisper = parseFasterWhisperJson(fasterWhisperRaw, ASSET_ID);

    expect(cpp.words.length).toBe(fasterWhisper.words.length);

    cpp.words.forEach((word, index) => {
      const equivalent = fasterWhisper.words[index];
      expect(equivalent?.text).toBe(word.text);
      expect(equivalent).toBeDefined();
      if (equivalent === undefined) {
        return;
      }
      expect(Math.abs(word.startMs - equivalent.startMs)).toBeLessThanOrEqual(MAX_WORD_TIMING_DRIFT_MS);
      expect(Math.abs(word.endMs - equivalent.endMs)).toBeLessThanOrEqual(MAX_WORD_TIMING_DRIFT_MS);
    });
  });
});

describe('buildTranscription', () => {
  it('lanza UnparseableOutputError cuando el documento construido no valida contra TranscriptionSchema', () => {
    expect(() =>
      buildTranscription({
        assetId: ASSET_ID,
        engine: 'whisper.cpp',
        language: 'invalid-lang',
        words: [],
        segments: [],
        raw: '{}',
      }),
    ).toThrow(UnparseableOutputError);
  });
});
