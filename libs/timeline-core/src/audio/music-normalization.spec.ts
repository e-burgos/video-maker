import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MUSIC_REFERENCE_LUFS,
  MUSIC_NORMALIZATION_MAX_GAIN_DB,
  musicNormalizationGainDb,
} from './music-normalization';

describe('musicNormalizationGainDb', () => {
  it('la referencia por defecto es -16 LUFS', () => {
    expect(DEFAULT_MUSIC_REFERENCE_LUFS).toBe(-16);
  });

  it('devuelve la diferencia entre la referencia y lo medido', () => {
    expect(musicNormalizationGainDb(-22.3, -16)).toBeCloseTo(6.3, 10);
  });

  it('atenúa una pista más fuerte que la referencia', () => {
    expect(musicNormalizationGainDb(-9, -16)).toBeCloseTo(-7, 10);
  });

  it('devuelve 0 cuando no hay medición', () => {
    expect(musicNormalizationGainDb(undefined, -16)).toBe(0);
  });

  it('devuelve 0 cuando la medición no es finita (loudnorm devuelve -inf en silencio)', () => {
    expect(musicNormalizationGainDb(Number.NEGATIVE_INFINITY, -16)).toBe(0);
  });

  it('recorta la amplificación de una pista casi muda al máximo', () => {
    expect(musicNormalizationGainDb(-70, -16)).toBe(MUSIC_NORMALIZATION_MAX_GAIN_DB);
  });

  it('recorta también la atenuación', () => {
    expect(musicNormalizationGainDb(-16 + MUSIC_NORMALIZATION_MAX_GAIN_DB + 5, -16)).toBe(
      -MUSIC_NORMALIZATION_MAX_GAIN_DB,
    );
  });
});
