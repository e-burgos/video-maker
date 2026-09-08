import type { Transcription, Word } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { softwareDemoPreset } from '../presets/software-demo.preset';
import type { MontagePreset } from '../presets/montage-preset';
import { spotConcepts } from './spot-concepts';

function word(text: string, startMs: number, endMs: number): Word {
  return { text, startMs, endMs };
}

function transcriptionOf(language: string, words: readonly Word[]): Transcription {
  return {
    assetId: 'aroll-01',
    engine: 'whisper.cpp',
    language,
    words: [...words],
    segments: [],
  };
}

function presetWithConcepts(concepts: MontagePreset['concepts']): MontagePreset {
  return { ...softwareDemoPreset, concepts };
}

describe('spotConcepts (CA-008)', () => {
  it('detecta conceptos por diccionario (frase y palabra) y por frecuencia, con sus rangos temporales', () => {
    const transcription = transcriptionOf('es', [
      word('el', 0, 200),
      word('machine', 200, 600),
      word('learning', 600, 1000),
      word('es', 1000, 1200),
      word('genial', 1200, 1700),
      word('python', 1700, 2000),
      word('genial', 2000, 2500),
      word('ya', 2500, 2600),
      word('python', 2600, 2900),
    ]);
    const preset = presetWithConcepts({
      minFrequency: 2,
      minTermLength: 4,
      dictionary: ['machine learning', 'python'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result).toEqual({
      stopwordLanguage: 'es',
      concepts: [
        {
          term: 'genial',
          source: 'frequency',
          occurrences: [
            { startMs: 1200, endMs: 1700, wordIndex: 4, wordCount: 1 },
            { startMs: 2000, endMs: 2500, wordIndex: 6, wordCount: 1 },
          ],
        },
        {
          term: 'machine learning',
          source: 'dictionary',
          occurrences: [{ startMs: 200, endMs: 1000, wordIndex: 1, wordCount: 2 }],
        },
        {
          term: 'python',
          source: 'dictionary',
          occurrences: [
            { startMs: 1700, endMs: 2000, wordIndex: 5, wordCount: 1 },
            { startMs: 2600, endMs: 2900, wordIndex: 8, wordCount: 1 },
          ],
        },
      ],
    });
  });

  it('dos corridas sobre la misma Transcription y el mismo preset producen el mismo resultado, en el mismo orden', () => {
    const transcription = transcriptionOf('es', [
      word('genial', 0, 400),
      word('python', 400, 800),
      word('genial', 800, 1200),
    ]);
    const preset = presetWithConcepts({
      minFrequency: 2,
      minTermLength: 4,
      dictionary: ['python'],
    });

    const first = spotConcepts(transcription, preset);
    const second = spotConcepts(transcription, preset);

    expect(second).toEqual(first);
  });

  it('rama "cumple por frecuencia": un término sin diccionario que alcanza minFrequency es concepto', () => {
    const transcription = transcriptionOf('es', [
      word('concepto', 0, 400),
      word('concepto', 400, 800),
    ]);
    const preset = presetWithConcepts({ minFrequency: 2, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'concepto',
        source: 'frequency',
        occurrences: [
          { startMs: 0, endMs: 400, wordIndex: 0, wordCount: 1 },
          { startMs: 400, endMs: 800, wordIndex: 1, wordCount: 1 },
        ],
      },
    ]);
  });

  it('rama "cumple por diccionario": una sola mención alcanza aunque no llegue a minFrequency', () => {
    const transcription = transcriptionOf('es', [word('kubernetes', 0, 500)]);
    const preset = presetWithConcepts({
      minFrequency: 5,
      minTermLength: 4,
      dictionary: ['kubernetes'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'kubernetes',
        source: 'dictionary',
        occurrences: [{ startMs: 0, endMs: 500, wordIndex: 0, wordCount: 1 }],
      },
    ]);
  });

  it('rama "no es concepto" por stopword: se descarta sin importar cuántas veces se repita', () => {
    const transcription = transcriptionOf('es', [
      word('el', 0, 200),
      word('el', 200, 400),
      word('el', 400, 600),
    ]);
    const preset = presetWithConcepts({ minFrequency: 1, minTermLength: 1, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([]);
  });

  it('rama "no es concepto" por ninguna condición: por debajo de minFrequency y ausente del diccionario', () => {
    const transcription = transcriptionOf('es', [word('compilador', 0, 500)]);
    const preset = presetWithConcepts({ minFrequency: 2, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([]);
  });

  it('descarta un término más corto que minTermLength aunque no sea stopword', () => {
    const transcription = transcriptionOf('es', [
      word('voy', 0, 200),
      word('voy', 200, 400),
    ]);
    const preset = presetWithConcepts({ minFrequency: 1, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([]);
  });

  it('descarta puntuación suelta que normaliza a cadena vacía', () => {
    const transcription = transcriptionOf('es', [word('...', 0, 200), word('genial', 200, 600)]);
    const preset = presetWithConcepts({ minFrequency: 1, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'genial',
        source: 'frequency',
        occurrences: [{ startMs: 200, endMs: 600, wordIndex: 1, wordCount: 1 }],
      },
    ]);
  });

  it('barrido greedy-longest-first: prefiere la frase de 2 tokens sobre la entrada de 1 token que la prefija (A-3)', () => {
    const transcription = transcriptionOf('es', [word('machine', 0, 400), word('learning', 400, 800)]);
    const preset = presetWithConcepts({
      minFrequency: 1,
      minTermLength: 4,
      dictionary: ['machine', 'machine learning'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'machine learning',
        source: 'dictionary',
        occurrences: [{ startMs: 0, endMs: 800, wordIndex: 0, wordCount: 2 }],
      },
    ]);
  });

  it('una frase del diccionario truncada al final de la transcripción no matchea y cae al camino de frecuencia', () => {
    const transcription = transcriptionOf('es', [word('machine', 0, 400)]);
    const preset = presetWithConcepts({
      minFrequency: 2,
      minTermLength: 4,
      dictionary: ['machine learning'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([]);
  });

  it('una frase del diccionario cuyo segundo token no matchea cae al camino de frecuencia palabra por palabra', () => {
    const transcription = transcriptionOf('es', [word('machine', 0, 400), word('vision', 400, 800)]);
    const preset = presetWithConcepts({
      minFrequency: 1,
      minTermLength: 4,
      dictionary: ['machine learning'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'machine',
        source: 'frequency',
        occurrences: [{ startMs: 0, endMs: 400, wordIndex: 0, wordCount: 1 }],
      },
      {
        term: 'vision',
        source: 'frequency',
        occurrences: [{ startMs: 400, endMs: 800, wordIndex: 1, wordCount: 1 }],
      },
    ]);
  });

  it('desempate alfabético entre entradas del diccionario de igual cantidad de tokens', () => {
    const transcription = transcriptionOf('es', [word('zebra', 0, 400), word('alpha', 400, 800)]);
    const preset = presetWithConcepts({
      minFrequency: 5,
      minTermLength: 4,
      dictionary: ['zebra', 'alpha'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'alpha',
        source: 'dictionary',
        occurrences: [{ startMs: 400, endMs: 800, wordIndex: 1, wordCount: 1 }],
      },
      {
        term: 'zebra',
        source: 'dictionary',
        occurrences: [{ startMs: 0, endMs: 400, wordIndex: 0, wordCount: 1 }],
      },
    ]);
  });

  it('una entrada de diccionario en blanco se ignora sin afectar al resto de las entradas', () => {
    const transcription = transcriptionOf('es', [word('python', 0, 400)]);
    const preset = presetWithConcepts({
      minFrequency: 5,
      minTermLength: 4,
      dictionary: ['   ', 'python'],
    });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toEqual([
      {
        term: 'python',
        source: 'dictionary',
        occurrences: [{ startMs: 0, endMs: 400, wordIndex: 0, wordCount: 1 }],
      },
    ]);
  });

  it('caso degenerado: transcripción sin palabras produce concepts: [] sin reventar', () => {
    const transcription = transcriptionOf('es', []);
    const preset = presetWithConcepts({ minFrequency: 2, minTermLength: 4, dictionary: ['python'] });

    const result = spotConcepts(transcription, preset);

    expect(result).toEqual({ concepts: [], stopwordLanguage: 'es' });
  });

  it('caso degenerado: diccionario del preset vacío no reemplaza el camino de frecuencia', () => {
    const transcription = transcriptionOf('es', [
      word('concepto', 0, 400),
      word('concepto', 400, 800),
    ]);
    const preset = presetWithConcepts({ minFrequency: 2, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.concepts).toHaveLength(1);
    expect(result.concepts[0]?.source).toBe('frequency');
  });

  it('degradación de stopwords (D-16): sin lista para "pt", el colchón lo pone minTermLength, no el idioma', () => {
    const transcription = transcriptionOf('pt', [
      word('de', 0, 200),
      word('conceito', 200, 700),
      word('conceito', 700, 1200),
    ]);
    const preset = presetWithConcepts({ minFrequency: 2, minTermLength: 4, dictionary: [] });

    const result = spotConcepts(transcription, preset);

    expect(result.stopwordLanguage).toBeNull();
    expect(result.concepts).toEqual([
      {
        term: 'conceito',
        source: 'frequency',
        occurrences: [
          { startMs: 200, endMs: 700, wordIndex: 1, wordCount: 1 },
          { startMs: 700, endMs: 1200, wordIndex: 2, wordCount: 1 },
        ],
      },
    ]);
  });
});
