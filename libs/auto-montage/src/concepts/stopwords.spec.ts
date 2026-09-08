import { describe, expect, it } from 'vitest';

import { EN_STOPWORDS, ES_STOPWORDS, resolveStopwords } from './stopwords';

describe('resolveStopwords (D-16)', () => {
  it('resuelve un subtag con región al idioma base', () => {
    const resolved = resolveStopwords('es-AR');

    expect(resolved.language).toBe('es');
    expect(resolved.terms).toBe(ES_STOPWORDS);
    expect(resolved.terms.has('el')).toBe(true);
  });

  it('resuelve un subtag sin región directamente', () => {
    const resolved = resolveStopwords('en');

    expect(resolved.language).toBe('en');
    expect(resolved.terms).toBe(EN_STOPWORDS);
    expect(resolved.terms.has('the')).toBe(true);
  });

  it('degrada a lista vacía para un idioma sin lista propia, sin caer a español (A-5)', () => {
    const resolved = resolveStopwords('pt');

    expect(resolved.language).toBeNull();
    expect(resolved.terms.size).toBe(0);
  });

  it('degrada también cuando el idioma sin lista viene con región', () => {
    const resolved = resolveStopwords('pt-BR');

    expect(resolved.language).toBeNull();
    expect(resolved.terms.size).toBe(0);
  });

  it('las listas ya están normalizadas (sin tildes) para permitir un has directo', () => {
    expect(ES_STOPWORDS.has('más'.normalize('NFC'))).toBe(false);
    expect(ES_STOPWORDS.has('mas')).toBe(true);
    expect(ES_STOPWORDS.has('también'.normalize('NFC'))).toBe(false);
    expect(ES_STOPWORDS.has('tambien')).toBe(true);
  });
});
