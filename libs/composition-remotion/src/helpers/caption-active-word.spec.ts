import { describe, expect, it } from 'vitest';
import { activeWordIndex, captionWordRenders } from './caption-active-word';
import type { CaptionWord } from './timeline-types';

const CONTIGUOUS_WORDS: readonly CaptionWord[] = [
  { text: 'one', fromFrame: 0, durationFrames: 10 },
  { text: 'two', fromFrame: 10, durationFrames: 8 },
  { text: 'three', fromFrame: 18, durationFrames: 12 },
];

describe('activeWordIndex', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [17, 1],
    [18, 2],
    [29, 2],
  ])('en el frame %i devuelve el índice %i (CA-007, borde semiabierto)', (frame, expected) => {
    expect(activeWordIndex(frame, CONTIGUOUS_WORDS)).toBe(expected);
  });

  it('el extremo superior de un rango queda excluido: fromFrame + durationFrames ya no pertenece a esa palabra', () => {
    expect(activeWordIndex(10, CONTIGUOUS_WORDS)).not.toBe(0);
    expect(activeWordIndex(18, CONTIGUOUS_WORDS)).not.toBe(1);
  });

  it('el primer y el último frame del clip resuelven a la primera y a la última palabra', () => {
    expect(activeWordIndex(0, CONTIGUOUS_WORDS)).toBe(0);
    expect(activeWordIndex(29, CONTIGUOUS_WORDS)).toBe(2);
  });

  it('devuelve -1 después de la última palabra y en un frame negativo (CA-007)', () => {
    expect(activeWordIndex(30, CONTIGUOUS_WORDS)).toBe(-1);
    expect(activeWordIndex(-1, CONTIGUOUS_WORDS)).toBe(-1);
  });

  it('devuelve -1 en un hueco entre dos palabras (RN-6)', () => {
    const wordsWithGap: readonly CaptionWord[] = [
      { text: 'one', fromFrame: 0, durationFrames: 5 },
      { text: 'two', fromFrame: 10, durationFrames: 5 },
    ];

    for (let frame = 5; frame < 10; frame += 1) {
      expect(activeWordIndex(frame, wordsWithGap)).toBe(-1);
    }
  });

  it('en un solapamiento, gana la palabra de menor índice (RN-5)', () => {
    const overlappingWords: readonly CaptionWord[] = [
      { text: 'one', fromFrame: 0, durationFrames: 10 },
      { text: 'two', fromFrame: 5, durationFrames: 10 },
    ];

    expect(activeWordIndex(7, overlappingWords)).toBe(0);
    expect(activeWordIndex(7, overlappingWords)).not.toBe(1);
  });

  it('devuelve -1 cuando no hay palabras', () => {
    expect(activeWordIndex(0, [])).toBe(-1);
  });
});

describe('captionWordRenders', () => {
  it('en cada frame del clip hay como máximo una palabra activa (RN-5) y la de emphasisIndex conserva el impacto en todos (CA-008, RN-7)', () => {
    for (let frame = 0; frame < 30; frame += 1) {
      const renders = captionWordRenders(frame, CONTIGUOUS_WORDS, 1);
      const activeCount = renders.filter((render) => render.state.isActive).length;

      expect(activeCount).toBeLessThanOrEqual(1);
      expect(renders[1]?.state.isEmphasis).toBe(true);
    }
  });

  it('la palabra de emphasisIndex mantiene el impacto aun en frames donde la palabra activa es otra', () => {
    const rendersDuringWordZero = captionWordRenders(0, CONTIGUOUS_WORDS, 1);
    const rendersInGap = captionWordRenders(
      -1,
      [
        { text: 'one', fromFrame: 0, durationFrames: 5 },
        { text: 'two', fromFrame: 10, durationFrames: 5 },
      ],
      1,
    );

    expect(rendersDuringWordZero[0]?.state.isActive).toBe(true);
    expect(rendersDuringWordZero[1]?.state.isActive).toBe(false);
    expect(rendersDuringWordZero[1]?.state.isEmphasis).toBe(true);
    expect(rendersInGap.every((render) => !render.state.isActive)).toBe(true);
    expect(rendersInGap[1]?.state.isEmphasis).toBe(true);
  });

  it('la palabra de emphasisIndex es isEmphasis e isActive a la vez cuando también le toca sonar', () => {
    const renders = captionWordRenders(12, CONTIGUOUS_WORDS, 1);

    expect(renders[1]?.state).toEqual({ isEmphasis: true, isActive: true });
  });

  it('con emphasisIndex null, ninguna palabra queda marcada de impacto', () => {
    const renders = captionWordRenders(0, CONTIGUOUS_WORDS, null);

    expect(renders.every((render) => !render.state.isEmphasis)).toBe(true);
  });

  it('empareja el texto original de cada palabra con su estado, en el mismo orden', () => {
    const renders = captionWordRenders(0, CONTIGUOUS_WORDS, null);

    expect(renders.map((render) => render.text)).toEqual(['one', 'two', 'three']);
  });
});
