import { describe, expect, it } from 'vitest';

import { tokenizeScript } from './script-tokens';

describe('tokenizeScript', () => {
  it('parte por espacios y saltos de línea conservando el texto original', () => {
    expect(tokenizeScript('Tu mirada dice mucho.\nEn nuestra óptica.')).toEqual([
      { text: 'Tu', key: 'tu' },
      { text: 'mirada', key: 'mirada' },
      { text: 'dice', key: 'dice' },
      { text: 'mucho.', key: 'mucho' },
      { text: 'En', key: 'en' },
      { text: 'nuestra', key: 'nuestra' },
      { text: 'óptica.', key: 'optica' },
    ]);
  });

  it('descarta los tokens que sólo son puntuación', () => {
    expect(tokenizeScript('hola — mundo')).toEqual([
      { text: 'hola', key: 'hola' },
      { text: 'mundo', key: 'mundo' },
    ]);
  });

  it('un guion vacío no produce tokens', () => {
    expect(tokenizeScript('   ')).toEqual([]);
  });
});
