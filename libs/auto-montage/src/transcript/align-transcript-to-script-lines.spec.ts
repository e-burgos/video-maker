import type { Word } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { alignTranscriptToScriptLines } from './align-transcript-to-script-lines';

function word(text: string, startMs: number, endMs: number): Word {
  return { text, startMs, endMs };
}

const WINDOWS = [
  { startMs: 0, endMs: 2218 },
  { startMs: 20_000, endMs: 25_689 },
];

describe('alignTranscriptToScriptLines', () => {
  it('alinea cada línea contra su propia ventana, sin mezclar palabras de dos frases', () => {
    const words = [
      word('Entramos', 0, 600),
      word('a', 600, 900),
      word('la', 900, 1200),
      word('Las', 20_000, 20_600),
      word('campañas', 20_600, 21_400),
    ];

    const result = alignTranscriptToScriptLines(words, ['Entramos a la', 'Las campañas'], WINDOWS);

    expect(result.words).toEqual(words);
    expect(result.corrected).toBe(0);
  });

  it('una palabra que falta en una línea no se puede rellenar con el tiempo de la línea siguiente', () => {
    const words = [word('Entramos', 0, 600), word('Las', 20_000, 20_600)];

    const result = alignTranscriptToScriptLines(
      words,
      ['Entramos a la plataforma', 'Las campañas'],
      WINDOWS,
    );

    expect(result.words.every((entry) => entry.endMs <= 2218 || entry.startMs >= 20_000)).toBe(true);
  });

  it('corrige el texto de una línea sin tocar los tiempos de las demás', () => {
    const words = [word('Entramos', 0, 600), word('campanas', 20_000, 20_600)];

    const result = alignTranscriptToScriptLines(words, ['Entramos', 'campañas'], WINDOWS);

    expect(result.words).toEqual([word('Entramos', 0, 600), word('campañas', 20_000, 20_600)]);
    expect(result.replaced).toBe(1);
  });

  it('asigna a la primera línea las palabras anteriores a toda ventana', () => {
    const windows = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 5000, endMs: 6000 },
    ];
    const words = [word('hola', 0, 400), word('chau', 5000, 5400)];

    const result = alignTranscriptToScriptLines(words, ['hola', 'chau'], windows);

    expect(result.words.map((entry) => entry.text)).toEqual(['hola', 'chau']);
  });

  it('suma los contadores de cada línea', () => {
    const words = [word('uno', 0, 400), word('dos', 20_000, 20_400)];

    const result = alignTranscriptToScriptLines(words, ['alfa', 'beta'], WINDOWS);

    expect(result).toMatchObject({ replaced: 2, corrected: 2 });
  });
});
