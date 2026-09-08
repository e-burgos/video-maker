import { describe, expect, it } from 'vitest';

import { DEFAULT_MUSIC_MIX, planDucking } from '@video-maker/timeline-core';

import { buildGainAutomationCurve, evaluateGainAutomationCurve } from './gain-automation-curve';

const FPS = 30;

const EXPECTED_KEYFRAMES = [
  { frame: 0, gainDb: -12 },
  { frame: 26, gainDb: -12 },
  { frame: 30, gainDb: -24 },
  { frame: 98, gainDb: -24 },
  { frame: 110, gainDb: -12 },
  { frame: 146, gainDb: -12 },
  { frame: 150, gainDb: -24 },
  { frame: 188, gainDb: -24 },
  { frame: 200, gainDb: -12 },
];

const EXPECTED_FACTOR_BY_FRAME: ReadonlyArray<readonly [number, number]> = [
  [0, 0.251188643151],
  [9, 0.251188643151],
  [17, 0.251188643151],
  [26, 0.251188643151],
  [27, 0.177827941004],
  [29, 0.089125093813],
  [30, 0.063095734448],
  [53, 0.063095734448],
  [75, 0.063095734448],
  [98, 0.063095734448],
  [102, 0.1],
  [106, 0.158489319246],
  [110, 0.251188643151],
  [122, 0.251188643151],
  [134, 0.251188643151],
  [146, 0.251188643151],
  [147, 0.177827941004],
  [149, 0.089125093813],
  [150, 0.063095734448],
  [163, 0.063095734448],
  [175, 0.063095734448],
  [188, 0.063095734448],
  [192, 0.1],
  [196, 0.158489319246],
  [200, 0.251188643151],
  [210, 0.251188643151],
];

const { automation } = planDucking(
  [
    { startMs: 1000, endMs: 3000 },
    { startMs: 5000, endMs: 6000 },
  ],
  DEFAULT_MUSIC_MIX,
  FPS,
);

describe('paridad numerica con volumeAtFrame (CA-002)', () => {
  it('planDucking produce los 9 keyframes exactos del §7.1 del architect.md', () => {
    expect(automation).toEqual(EXPECTED_KEYFRAMES);
  });

  const curve = buildGainAutomationCurve(automation, FPS);

  it.each(EXPECTED_FACTOR_BY_FRAME)(
    'el frame %i evalua al factor esperado dentro de la tolerancia 1e-6',
    (frame, expectedFactor) => {
      const factor = evaluateGainAutomationCurve(curve, frame / FPS);

      expect(Math.abs(factor - expectedFactor)).toBeLessThan(1e-6);
    },
  );

  it('la interpolacion es en dB, no en amplitud: el frame 102 da exactamente 0.1', () => {
    const factor = evaluateGainAutomationCurve(curve, 102 / FPS);

    expect(factor).toBeCloseTo(0.1, 9);
    expect(Math.abs(factor - 0.125793)).toBeGreaterThan(1e-3);
  });

  it('antes del primer keyframe y despues del ultimo el valor es plano (RN-3)', () => {
    expect(evaluateGainAutomationCurve(curve, 0)).toBeCloseTo(0.251188643151, 9);
    expect(evaluateGainAutomationCurve(curve, 210 / FPS)).toBeCloseTo(0.251188643151, 9);
  });
});
