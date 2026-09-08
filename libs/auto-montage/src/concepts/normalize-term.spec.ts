import { describe, expect, it } from 'vitest';

import { normalizeTerm } from './normalize-term';

describe('normalizeTerm', () => {
  it('pasa a minúsculas', () => {
    expect(normalizeTerm('CÓDIGO')).toBe('codigo');
  });

  it('quita tildes y diacríticos', () => {
    expect(normalizeTerm('sartén')).toBe('sarten');
    expect(normalizeTerm('bateria')).toBe('bateria');
    expect(normalizeTerm('definición')).toBe('definicion');
  });

  it('quita signos de puntuación', () => {
    expect(normalizeTerm('¡Hola!')).toBe('hola');
    expect(normalizeTerm('build,')).toBe('build');
  });

  it('conserva dígitos', () => {
    expect(normalizeTerm('Versión2')).toBe('version2');
  });

  it('produce cadena vacía para puntuación suelta', () => {
    expect(normalizeTerm('...')).toBe('');
  });
});
