import { describe, expect, it } from 'vitest';
import { punchInStyle } from './punch-in-style';

describe('punchInStyle', () => {
  it('devuelve el transform y transformOrigin exactos para el anchor default (center)', () => {
    expect(punchInStyle({ scale: 1.15, translateX: 0, translateY: 0 })).toEqual({
      transform: 'scale(1.15) translate(0px, 0px)',
      transformOrigin: '50% 50%',
    });
  });

  it('usa "50% 0%" para anchor "top"', () => {
    const style = punchInStyle({ scale: 1.15, translateX: 0, translateY: 0 }, 'top');

    expect(style.transformOrigin).toBe('50% 0%');
  });

  it('usa "50% 33%" para anchor "face-hint"', () => {
    const style = punchInStyle({ scale: 1.15, translateX: 0, translateY: 0 }, 'face-hint');

    expect(style.transformOrigin).toBe('50% 33%');
  });

  it('no redondea ni normaliza escalas y traslados con decimales o negativos', () => {
    const style = punchInStyle({ scale: 1.1, translateX: -12.5, translateY: 8 });

    expect(style.transform).toBe('scale(1.1) translate(-12.5px, 8px)');
  });
});
