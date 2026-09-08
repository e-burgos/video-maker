import { describe, expect, it } from 'vitest';

import { formatFilterNumber } from './format-filter-number';

describe('formatFilterNumber', () => {
  it('formatea un entero sin decimales de cola', () => {
    expect(formatFilterNumber(100)).toBe('100');
  });

  it('formatea un decimal simple sin ceros de cola', () => {
    expect(formatFilterNumber(10.5)).toBe('10.5');
  });

  it('formatea cero', () => {
    expect(formatFilterNumber(0)).toBe('0');
  });

  it('formatea un negativo', () => {
    expect(formatFilterNumber(-12)).toBe('-12');
  });

  it('nunca emite notación exponencial', () => {
    expect(formatFilterNumber(1e-7)).toBe('0.0000001');
  });

  it('emite 9 decimales exactos para 26/30', () => {
    expect(formatFilterNumber(26 / 30)).toBe('0.866666667');
  });
});
