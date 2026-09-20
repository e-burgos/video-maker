import type { Word } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { alignTranscriptToScript } from './align-transcript-to-script';

function word(text: string, startMs: number, endMs: number): Word {
  return { text, startMs, endMs };
}

function texts(words: readonly Word[]): string[] {
  return words.map((entry) => entry.text);
}

describe('alignTranscriptToScript', () => {
  it('devuelve las palabras intactas cuando el guion está vacío', () => {
    const words = [word('hola', 0, 300)];

    expect(alignTranscriptToScript(words, '   ')).toEqual({
      words,
      replaced: 0,
      removed: 0,
      inserted: 0,
      dropped: 0,
      corrected: 0,
    });
  });

  it('devuelve el guion intacto cuando no hay palabras', () => {
    expect(alignTranscriptToScript([], 'hola mundo').words).toEqual([]);
  });

  it('restituye la tilde de una palabra que Whisper transcribió sin ella, sin tocar los tiempos', () => {
    const words = [word('necesitas', 1000, 1400), word('para', 1400, 1600)];

    const result = alignTranscriptToScript(words, 'necesitás para');

    expect(result.words).toEqual([word('necesitás', 1000, 1400), word('para', 1400, 1600)]);
    expect(result).toMatchObject({ replaced: 1, removed: 0, inserted: 0, dropped: 0, corrected: 1 });
  });

  it('reemplaza una palabra mal oída conservando su ventana temporal', () => {
    const words = [word('Tu', 0, 200), word('mirada', 200, 500), word('hice', 500, 800), word('mucho', 800, 1100)];

    const result = alignTranscriptToScript(words, 'Tu mirada dice mucho');

    expect(texts(result.words)).toEqual(['Tu', 'mirada', 'dice', 'mucho']);
    expect(result.words[2]).toEqual(word('dice', 500, 800));
    expect(result).toMatchObject({ replaced: 1, removed: 0, inserted: 0, corrected: 1 });
  });

  it('elimina una palabra que Whisper inventó', () => {
    const words = [word('formas', 0, 300), word('y', 300, 400), word('de', 400, 500), word('estilo', 500, 900)];

    const result = alignTranscriptToScript(words, 'formas y estilo');

    expect(texts(result.words)).toEqual(['formas', 'y', 'estilo']);
    expect(result).toMatchObject({ replaced: 0, removed: 1, inserted: 0, corrected: 1 });
  });

  it('funde dos palabras de Whisper en una del guion repartiendo el span completo (Ven y → Vení)', () => {
    const words = [word('Ven', 1000, 1200), word('y', 1200, 1500), word('a', 1500, 1600)];

    const result = alignTranscriptToScript(words, 'Vení a');

    expect(texts(result.words)).toEqual(['Vení', 'a']);
    expect(result.words[0]).toEqual(word('Vení', 1000, 1500));
    expect(result.words[1]).toEqual(word('a', 1500, 1600));
    expect(result).toMatchObject({ replaced: 1, removed: 1, inserted: 0, corrected: 2 });
  });

  it('parte el span de una palabra de Whisper en las dos del guion que la reemplazan', () => {
    const words = [word('sinembargo', 0, 400), word('vamos', 400, 700)];

    const result = alignTranscriptToScript(words, 'sin embargo vamos');

    expect(result.words).toEqual([
      word('sin', 0, 200),
      word('embargo', 200, 400),
      word('vamos', 400, 700),
    ]);
    expect(result).toMatchObject({ replaced: 1, removed: 0, inserted: 1, corrected: 2 });
  });

  it('reparte en el hueco vecino las palabras que Whisper omitió', () => {
    const words = [word('hola', 0, 300), word('mundo', 1300, 1600)];

    const result = alignTranscriptToScript(words, 'hola querido mundo');

    expect(result.words).toEqual([
      word('hola', 0, 300),
      word('querido', 300, 1300),
      word('mundo', 1300, 1600),
    ]);
    expect(result).toMatchObject({ replaced: 0, removed: 0, inserted: 1, dropped: 0, corrected: 1 });
  });

  it('descarta la palabra omitida cuando no hay hueco donde ubicarla', () => {
    const words = [word('hola', 0, 300), word('mundo', 300, 600)];

    const result = alignTranscriptToScript(words, 'hola querido mundo');

    expect(texts(result.words)).toEqual(['hola', 'mundo']);
    expect(result).toMatchObject({ replaced: 0, removed: 0, inserted: 0, dropped: 1, corrected: 0 });
  });

  it('reparte al final del audio las palabras del guion que Whisper no llegó a oír', () => {
    const words = [word('hola', 0, 300), word('mundo', 300, 600)];

    const result = alignTranscriptToScript(words, 'hola mundo cruel');

    expect(texts(result.words)).toEqual(['hola', 'mundo']);
    expect(result.dropped).toBe(1);
  });

  it('deja las palabras ordenadas y sin solaparse', () => {
    const words = [
      word('Tu', 0, 200),
      word('mirada', 200, 500),
      word('hice', 500, 800),
      word('mucho', 800, 1100),
      word('Ven', 1400, 1600),
      word('y', 1600, 1900),
    ];

    const { words: aligned } = alignTranscriptToScript(words, 'Tu mirada dice mucho ahora Vení');

    aligned.forEach((entry, index) => {
      expect(entry.endMs).toBeGreaterThanOrEqual(entry.startMs);
      const previous = aligned[index - 1];
      if (previous !== undefined) {
        expect(previous.endMs).toBeLessThanOrEqual(entry.startMs);
      }
    });
  });

  it('no estira una palabra insertada sobre un silencio largo: la pega al run anterior dentro de 1500 ms', () => {
    const words = [word('hola', 0, 300), word('mundo', 18_300, 18_600)];

    const result = alignTranscriptToScript(words, 'hola querido mundo');

    expect(result.words).toEqual([
      word('hola', 0, 300),
      word('querido', 300, 1800),
      word('mundo', 18_300, 18_600),
    ]);
  });

  it('reparte varias palabras insertadas dentro del mismo tope de 1500 ms', () => {
    const words = [word('hola', 0, 300), word('mundo', 18_300, 18_600)];

    const result = alignTranscriptToScript(words, 'hola muy querido mundo');

    expect(result.words).toEqual([
      word('hola', 0, 300),
      word('muy', 300, 1050),
      word('querido', 1050, 1800),
      word('mundo', 18_300, 18_600),
    ]);
  });

  it('no extiende el fin del run que reemplaza más allá de su última palabra', () => {
    const words = [word('sinembargo', 0, 3)];

    const result = alignTranscriptToScript(words, 'sin embargo pero igual ahora');

    expect(result.words).toHaveLength(5);
    expect(result.words[result.words.length - 1]?.endMs).toBe(3);
  });

  it('un guion que no se parece en nada reemplaza el bloque entero', () => {
    const words = [word('uno', 0, 300), word('dos', 300, 600)];

    const result = alignTranscriptToScript(words, 'alfa beta');

    expect(texts(result.words)).toEqual(['alfa', 'beta']);
    expect(result).toMatchObject({ replaced: 2, removed: 0, inserted: 0, corrected: 2 });
  });
});
