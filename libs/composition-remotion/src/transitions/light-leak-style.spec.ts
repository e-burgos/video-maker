import { describe, expect, it } from 'vitest';
import { lightLeakOpacity, lightLeakOverlayStyle, lightLeakSceneStyle } from './light-leak-style';

describe('lightLeakStyle', () => {
  it('la escena entrante aparece con el progreso y la saliente queda opaca debajo', () => {
    expect(lightLeakSceneStyle('entering', 0.25)).toEqual({ opacity: 0.25 });
    expect(lightLeakSceneStyle('exiting', 0.25)).toEqual({ opacity: 1 });
  });

  it('el destello arranca y termina en cero y tiene su pico a mitad del corte', () => {
    expect(lightLeakOpacity(0)).toBe(0);
    expect(lightLeakOpacity(1)).toBeCloseTo(0, 10);
    expect(lightLeakOpacity(0.5)).toBeCloseTo(0.5, 10);
    expect(lightLeakOpacity(0.5, 0.3)).toBeCloseTo(0.3, 10);
  });

  it('usa tonos cálidos sin blanco puro y el foco viaja de izquierda a derecha', () => {
    const start = lightLeakOverlayStyle(0.1);
    const end = lightLeakOverlayStyle(0.9);

    expect(String(start.background)).not.toMatch(/255, 255, 255|#fff/iu);
    expect(String(start.background)).toContain('at 26% 35%');
    expect(String(end.background)).toContain('at 74% 35%');
  });
});
