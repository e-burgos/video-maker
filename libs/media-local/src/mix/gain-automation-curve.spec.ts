import { describe, expect, it } from 'vitest';

import { gainDbToVolume } from './gain-db-to-volume';
import {
  buildGainAutomationCurve,
  evaluateGainAutomationCurve,
  isIdentityGainCurve,
} from './gain-automation-curve';

const FPS = 30;

const THREE_KEYFRAME_AUTOMATION = [
  { frame: 0, gainDb: -12 },
  { frame: 30, gainDb: -24 },
  { frame: 60, gainDb: -12 },
];

describe('buildGainAutomationCurve', () => {
  it('automation vacío produce curva constante identidad', () => {
    expect(buildGainAutomationCurve([], FPS)).toEqual({ kind: 'constant', volume: 1 });
  });

  it('un solo keyframe produce curva constante con su volumen', () => {
    const curve = buildGainAutomationCurve([{ frame: 0, gainDb: -6 }], FPS);

    expect(curve).toEqual({ kind: 'constant', volume: gainDbToVolume(-6) });
  });

  it('dos o mas keyframes producen la curva piecewise exacta del ejemplo del architect.md', () => {
    expect(buildGainAutomationCurve(THREE_KEYFRAME_AUTOMATION, FPS)).toEqual({
      kind: 'piecewise',
      firstSeconds: 0,
      firstGainDb: -12,
      lastSeconds: 2,
      lastGainDb: -12,
      segments: [
        { startSeconds: 0, endSeconds: 1, startGainDb: -12, slopeDbPerSecond: -12 },
        { startSeconds: 1, endSeconds: 2, startGainDb: -24, slopeDbPerSecond: 12 },
      ],
    });
  });

  it('dos keyframes con el mismo frame producen un segmento con pendiente 0, nunca Infinity/NaN', () => {
    const curve = buildGainAutomationCurve(
      [
        { frame: 10, gainDb: -6 },
        { frame: 10, gainDb: -18 },
      ],
      FPS,
    );

    expect(curve).toEqual({
      kind: 'piecewise',
      firstSeconds: 10 / 30,
      firstGainDb: -6,
      lastSeconds: 10 / 30,
      lastGainDb: -18,
      segments: [{ startSeconds: 10 / 30, endSeconds: 10 / 30, startGainDb: -6, slopeDbPerSecond: 0 }],
    });
  });
});

describe('evaluateGainAutomationCurve', () => {
  it('una curva constante devuelve siempre el mismo volumen', () => {
    const curve = buildGainAutomationCurve([{ frame: 0, gainDb: -6 }], FPS);

    expect(evaluateGainAutomationCurve(curve, 0)).toBe(gainDbToVolume(-6));
    expect(evaluateGainAutomationCurve(curve, 999)).toBe(gainDbToVolume(-6));
  });

  it('antes del primer keyframe el valor es plano, igual al primero', () => {
    const curve = buildGainAutomationCurve(THREE_KEYFRAME_AUTOMATION, FPS);

    expect(evaluateGainAutomationCurve(curve, 0)).toBeCloseTo(gainDbToVolume(-12), 9);
    expect(evaluateGainAutomationCurve(curve, -5)).toBeCloseTo(gainDbToVolume(-12), 9);
  });

  it('despues del ultimo keyframe el valor es plano, igual al ultimo', () => {
    const curve = buildGainAutomationCurve(THREE_KEYFRAME_AUTOMATION, FPS);

    expect(evaluateGainAutomationCurve(curve, 3)).toBeCloseTo(gainDbToVolume(-12), 9);
  });

  it('interpola en dB dentro de cada segmento, nunca en amplitud', () => {
    const curve = buildGainAutomationCurve(THREE_KEYFRAME_AUTOMATION, FPS);

    expect(evaluateGainAutomationCurve(curve, 0.5)).toBeCloseTo(gainDbToVolume(-18), 9);
    expect(evaluateGainAutomationCurve(curve, 1.5)).toBeCloseTo(gainDbToVolume(-18), 9);
  });
});

describe('isIdentityGainCurve', () => {
  it('es identidad cuando la curva es constante con volumen 1', () => {
    expect(isIdentityGainCurve({ kind: 'constant', volume: 1 })).toBe(true);
  });

  it('no es identidad cuando la curva es constante con otro volumen', () => {
    expect(isIdentityGainCurve({ kind: 'constant', volume: 0.5 })).toBe(false);
  });

  it('no es identidad cuando la curva es piecewise', () => {
    const curve = buildGainAutomationCurve(THREE_KEYFRAME_AUTOMATION, FPS);

    expect(isIdentityGainCurve(curve)).toBe(false);
  });
});
