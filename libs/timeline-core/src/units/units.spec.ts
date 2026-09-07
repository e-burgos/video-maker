import { describe, expect, it } from 'vitest';

import type { Fps } from '../types/units';
import { framesToMs, msToFrames } from './units';

describe('msToFrames', () => {
  it('convierte exacto con redondeo por defecto', () => {
    expect(msToFrames(1000, 30)).toBe(30);
  });

  it('trunca hacia abajo con rounding floor', () => {
    expect(msToFrames(999, 30, 'floor')).toBe(29);
  });

  it('redondea hacia arriba con rounding ceil', () => {
    expect(msToFrames(16, 60, 'ceil')).toBe(1);
  });

  it('redondea .5 hacia +infinito', () => {
    expect(msToFrames(850, 30)).toBe(26);
  });

  it('devuelve 0 para ms igual a 0', () => {
    expect(msToFrames(0, 30)).toBe(0);
  });

  it.each([24, 25, 30, 50, 60] as Fps[])('soporta fps %i', (fps) => {
    expect(msToFrames(1000, fps)).toBe(fps);
  });
});

describe('framesToMs', () => {
  it('convierte exacto con redondeo por defecto', () => {
    expect(framesToMs(30, 30)).toBe(1000);
  });

  it('trunca hacia abajo con rounding floor', () => {
    expect(framesToMs(1, 60, 'floor')).toBe(16);
  });

  it('redondea hacia arriba con rounding ceil', () => {
    expect(framesToMs(1, 30, 'ceil')).toBe(34);
  });

  it('redondea hacia el entero más cercano por defecto', () => {
    expect(framesToMs(1, 25)).toBe(40);
  });

  it('devuelve 0 para frames igual a 0', () => {
    expect(framesToMs(0, 30)).toBe(0);
  });

  it.each([24, 25, 30, 50, 60] as Fps[])('soporta fps %i', (fps) => {
    expect(framesToMs(fps, fps)).toBe(1000);
  });

  it('la ida y vuelta se mantiene dentro de la duración de un frame', () => {
    const fps: Fps = 24;
    const ms = 1237;
    const roundTrip = framesToMs(msToFrames(ms, fps), fps);
    expect(Math.abs(roundTrip - ms)).toBeLessThanOrEqual(1000 / fps);
  });
});
