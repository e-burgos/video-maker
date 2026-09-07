import { describe, expect, it } from 'vitest';

import {
  adjacentSilences,
  containedSilences,
  degenerateSilences,
  emptyTranscription,
  leadingSilenceTranscription,
  overlappingSilences,
  singleWordTranscription,
} from '../__fixtures__/silence.fixture';
import { spanishTranscription } from '../__fixtures__/transcription';
import { detectSilencesFromWords } from './detect-silences';
import { mergeSilences } from './merge-silences';

describe('detectSilencesFromWords', () => {
  it('reporta solo los huecos de 500 y 800 ms, no el de 300 ms', () => {
    expect(detectSilencesFromWords(spanishTranscription)).toEqual([
      { startMs: 2180, endMs: 2680 },
      { startMs: 3860, endMs: 4660 },
    ]);
  });

  it('el umbral es inclusivo: un hueco de exactamente 500 ms se detecta', () => {
    const transcription = {
      ...emptyTranscription,
      words: [
        { text: 'a', startMs: 0, endMs: 100 },
        { text: 'b', startMs: 600, endMs: 700 },
      ],
    };

    expect(detectSilencesFromWords(transcription, { minSilenceMs: 500 })).toEqual([
      { startMs: 100, endMs: 600 },
    ]);
  });

  it('devuelve [] para una transcripción vacía', () => {
    expect(detectSilencesFromWords(emptyTranscription)).toEqual([]);
  });

  it('devuelve [] cuando hay una sola palabra', () => {
    expect(detectSilencesFromWords(singleWordTranscription)).toEqual([]);
  });

  it('no reporta silencio anterior a la primera palabra ni posterior a la última', () => {
    expect(detectSilencesFromWords(leadingSilenceTranscription)).toEqual([]);
  });

  it('con minSilenceMs: 0 reporta todo hueco mayor a 0', () => {
    const silences = detectSilencesFromWords(spanishTranscription, { minSilenceMs: 0 });
    expect(silences.every((silence) => silence.endMs > silence.startMs)).toBe(true);
    expect(silences.length).toBeGreaterThan(2);
  });
});

describe('mergeSilences', () => {
  it('une dos rangos superpuestos (CA-004)', () => {
    expect(mergeSilences(overlappingSilences, [])).toEqual([{ startMs: 1000, endMs: 2200 }]);
  });

  it('une dos rangos exactamente adyacentes', () => {
    expect(mergeSilences([{ startMs: 0, endMs: 500 }], [{ startMs: 500, endMs: 900 }])).toEqual([
      { startMs: 0, endMs: 900 },
    ]);
  });

  it('un rango contenido dentro de otro se absorbe', () => {
    expect(mergeSilences(containedSilences, [])).toEqual([{ startMs: 1000, endMs: 2000 }]);
  });

  it('descarta rangos degenerados (endMs <= startMs)', () => {
    expect(mergeSilences(degenerateSilences, [])).toEqual([]);
  });

  it('devuelve [] cuando ambas listas están vacías', () => {
    expect(mergeSilences([], [])).toEqual([]);
  });

  it('devuelve la otra lista normalizada cuando una está vacía', () => {
    expect(mergeSilences([], adjacentSilences)).toEqual([{ startMs: 1000, endMs: 2000 }]);
  });

  it('es conmutativa', () => {
    const ab = mergeSilences(overlappingSilences, containedSilences);
    const ba = mergeSilences(containedSilences, overlappingSilences);
    expect(ab).toEqual(ba);
  });

  it('ordena rangos desordenados antes de fusionar', () => {
    expect(
      mergeSilences([{ startMs: 2000, endMs: 2500 }], [{ startMs: 0, endMs: 300 }]),
    ).toEqual([
      { startMs: 0, endMs: 300 },
      { startMs: 2000, endMs: 2500 },
    ]);
  });
});
