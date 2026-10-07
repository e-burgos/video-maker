import { describe, expect, it } from 'vitest';

import { intelligibilityScore, normalizeWords } from './intelligibility-score';

describe('intelligibilityScore', () => {
  it('ignores case, accents, punctuation and spoken numbers', () => {
    expect(normalizeWords('¿Programá por día? El Counter 15.')).toEqual(['programa', 'por', 'dia', 'el', 'counter', 'quince']);
    expect(intelligibilityScore('El Counter quince, todo en uno.', 'el counter 15 todo en uno')).toBe(1);
  });

  it('drops when words are misheard or missing', () => {
    const expected = 'Programá tus campañas por horario, por día o por sucursal.';
    expect(intelligibilityScore(expected, 'Programa por Franco Auraria, por Villarro')).toBeLessThan(0.6);
    expect(intelligibilityScore(expected, 'Programa tus campañas por horario, por día o por sucursal')).toBe(1);
  });

  it('treats two empty texts as a perfect match', () => {
    expect(intelligibilityScore('', '')).toBe(1);
  });
});
