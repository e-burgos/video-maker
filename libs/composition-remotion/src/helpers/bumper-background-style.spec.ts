import { describe, expect, it } from 'vitest';

import {
  bumperShapeSpots,
  glowBackgroundStyle,
  gradientBackgroundStyle,
  hexWithAlpha,
  noiseBlobs,
  readableTextColor,
  typedCaption,
} from './bumper-background-style';

const colors = { base: '#ffffff', accent: '#38bdf8', secondary: '#14b8a6' };

describe('bumper-background-style', () => {
  it('convierte un hex a rgba con alfa', () => {
    expect(hexWithAlpha('#38bdf8', 0.5)).toBe('rgba(56, 189, 248, 0.5)');
  });

  it('elige texto oscuro sobre fondo claro y claro sobre oscuro', () => {
    expect(readableTextColor('#ffffff')).toBe('#0f172a');
    expect(readableTextColor('#0b1020')).toBe('#f8fafc');
  });

  it('el degradé gira con el progreso y nunca usa blanco fuera del color base', () => {
    expect(String(gradientBackgroundStyle(colors, 0).background)).toContain('115deg');
    expect(String(gradientBackgroundStyle(colors, 1).background)).toContain('155deg');
  });

  it('el resplandor arranca apagado y crece', () => {
    expect(String(glowBackgroundStyle(colors, 0).background)).toContain('rgba(56, 189, 248, 0)');
    expect(String(glowBackgroundStyle(colors, 1).background)).toContain('rgba(56, 189, 248, 0.5)');
  });

  it('las manchas de ruido se mueven de un cuadro a otro y son deterministas', () => {
    expect(noiseBlobs(colors, 10, 'v')).toEqual(noiseBlobs(colors, 10, 'v'));
    expect(noiseBlobs(colors, 10, 'v')[0]?.xPercent).not.toBe(noiseBlobs(colors, 40, 'v')[0]?.xPercent);
    expect(noiseBlobs(colors, 10, 'v')).toHaveLength(5);
  });

  it('las formas entran escalonadas y terminan a tamaño pleno', () => {
    expect(bumperShapeSpots(colors, 0)[0]?.scale).toBe(0);
    expect(bumperShapeSpots(colors, 2)[1]?.scale).toBe(0);
    expect(bumperShapeSpots(colors, 40).every((spot) => spot.scale === 1)).toBe(true);
  });

  it('el remate se tipea letra por letra', () => {
    expect(typedCaption('acme.test', 10, 10, 9)).toBe('');
    expect(typedCaption('acme.test', 14, 10, 8)).toBe('acme');
    expect(typedCaption('acme.test', 30, 10, 9)).toBe('acme.test');
  });
});
