import { describe, expect, it } from 'vitest';

import { groupWordsForCaptions } from './group-words-for-captions';
import type { TranscriptWord } from './group-words-for-captions';

const WORD_MS = 300;

function spokenWords(sentence: string, startMs = 0): TranscriptWord[] {
  return sentence.split(' ').map((text, index) => ({
    text,
    startMs: startMs + index * WORD_MS,
    endMs: startMs + index * WORD_MS + WORD_MS - 20,
  }));
}

function groupTexts(words: readonly TranscriptWord[]): string[] {
  return groupWordsForCaptions(words, {
    minWords: 3,
    maxWords: 10,
    minDurationMs: 2000,
    maxDurationMs: 4000,
    maxGapMs: 900,
    maxChars: 52,
    respectPhrases: true,
  }).map((group) => group.words.map((word) => word.text).join(' '));
}

describe('groupWordsForCaptions — respectPhrases (FIX-e-burgos-011)', () => {
  it('corta en la coma en vez de partir la frase por cantidad de palabras', () => {
    const words = spokenWords(
      'El chat es un asistente de inteligencia artificial que conoce tu negocio: tus campañas, tus pantallas y tus medios.',
    );

    expect(groupTexts(words)).toEqual([
      'El chat es un asistente de inteligencia artificial',
      'que conoce tu negocio:',
      'tus campañas, tus pantallas y tus medios.',
    ]);
  });

  it('nunca deja una palabra huérfana y prefiere cortar antes de una conjunción', () => {
    const groups = groupTexts(
      spokenWords('Con Enter la mandás y el asistente consulta tus datos reales.'),
    );

    expect(groups).toEqual(['Con Enter la mandás', 'y el asistente consulta tus datos reales.']);
  });

  it('no corta después de un artículo o una preposición', () => {
    const groups = groupTexts(
      spokenWords('Gracias por mirar este tutorial de Display Ads y nos vemos en el próximo video.'),
    );

    for (const group of groups) {
      expect(group).not.toMatch(/ (de|el|la|en|tu|por)$/u);
    }
  });

  it('no mezcla dos oraciones en el mismo subtítulo aunque la primera sea corta', () => {
    const groups = groupTexts(
      spokenWords(
        'La charla queda guardada en el historial, a la izquierda, para retomarla cuando quieras. Probalo ahora con tu primera pregunta.',
      ),
    );

    expect(groups).toEqual([
      'La charla queda guardada en el historial,',
      'a la izquierda, para retomarla cuando quieras.',
      'Probalo ahora con tu primera pregunta.',
    ]);
  });

  it('cada subtítulo entra en una línea de 52 caracteres y tiene al menos 3 palabras', () => {
    const groups = groupTexts(
      spokenWords(
        'Si todavía no tiene análisis, tocás Iniciar análisis de competencia: la plataforma busca los comercios que tenés cerca, en quinientos metros a la redonda.',
      ),
    );

    for (const group of groups) {
      expect([...group].length).toBeLessThanOrEqual(52);
      expect(group.split(' ').length).toBeGreaterThanOrEqual(3);
    }
    expect(groups.join(' ')).toContain('análisis de competencia:');
  });

  it('entre cortes de igual calidad prefiere el que deja ambas mitades en una línea', () => {
    const groups = groupTexts(
      spokenWords(
        'Una campaña pasa por cuatro estados: Borrador, Activa, Pausada y Finalizada, que llega sola con la fecha de fin.',
      ),
    );

    expect(groups).toEqual([
      'Una campaña pasa por cuatro estados:',
      'Borrador, Activa, Pausada y Finalizada,',
      'que llega sola con la fecha de fin.',
    ]);
  });

  it('un silencio largo corta aunque no haya puntuación', () => {
    const first = spokenWords('Elegí la sucursal');
    const second = spokenWords('y tocá Analizar', 5000);

    expect(groupTexts([...first, ...second])).toEqual(['Elegí la sucursal', 'y tocá Analizar']);
  });

  it('sin respectPhrases conserva el agrupado por cantidad de palabras', () => {
    const groups = groupWordsForCaptions(spokenWords('uno dos tres cuatro cinco'), { maxWords: 3 });

    expect(groups.map((group) => group.words.length)).toEqual([3, 2]);
  });
});
