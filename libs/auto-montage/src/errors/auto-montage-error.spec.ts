import { describe, expect, it } from 'vitest';

import { isAutoMontageError } from './auto-montage-error';
import { PathEscapesProjectError } from './path-escapes-project-error';

describe('isAutoMontageError', () => {
  it('es true para una instancia de la jerarquía de errores de la lib', () => {
    const error = new PathEscapesProjectError({ projectRoot: '/tmp/media/p', attemptedPath: '/tmp/other' });

    expect(isAutoMontageError(error)).toBe(true);
  });

  it('es false para un Error genérico', () => {
    expect(isAutoMontageError(new Error('generic'))).toBe(false);
  });

  it('es false para un valor que no es un Error', () => {
    expect(isAutoMontageError('not-an-error')).toBe(false);
  });
});
