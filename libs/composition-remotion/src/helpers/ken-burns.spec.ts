import { describe, expect, it } from 'vitest';

import { DEFAULT_IMAGE_KEN_BURNS, kenBurnsCss, kenBurnsProgress, kenBurnsTransform } from './ken-burns';

describe('kenBurnsProgress', () => {
  it('goes from 0 on the first frame to 1 on the last', () => {
    expect(kenBurnsProgress(0, 90)).toBe(0);
    expect(kenBurnsProgress(89, 90)).toBe(1);
  });

  it('is exactly half way at the middle frame', () => {
    expect(kenBurnsProgress(45, 91)).toBeCloseTo(0.5, 6);
  });

  it('clamps a frame outside the scene instead of extrapolating', () => {
    expect(kenBurnsProgress(-10, 90)).toBe(0);
    expect(kenBurnsProgress(400, 90)).toBe(1);
  });

  it('stays at 0 for a one frame scene instead of dividing by zero', () => {
    expect(kenBurnsProgress(0, 1)).toBe(0);
    expect(kenBurnsProgress(0, 0)).toBe(0);
  });
});

describe('kenBurnsTransform', () => {
  it('interpolates the zoom between the two ends of the move', () => {
    const move = { zoomFrom: 1, zoomTo: 1.2 };

    expect(kenBurnsTransform({ frame: 0, durationInFrames: 101, move }).scale).toBeCloseTo(1, 6);
    expect(kenBurnsTransform({ frame: 50, durationInFrames: 101, move }).scale).toBeCloseTo(1.1, 6);
    expect(kenBurnsTransform({ frame: 100, durationInFrames: 101, move }).scale).toBeCloseTo(1.2, 6);
  });

  it('pans further as the zoom grows and does not pan at all on the first frame', () => {
    const move = { zoomFrom: 1.05, zoomTo: 1.4 };
    const first = kenBurnsTransform({ frame: 0, durationInFrames: 101, move });
    const last = kenBurnsTransform({ frame: 100, durationInFrames: 101, move });

    expect(first.translateXPercent).toBe(0);
    expect(first.translateYPercent).toBe(0);
    expect(Math.abs(last.translateXPercent)).toBeGreaterThan(0);
    expect(last.translateYPercent).toBeCloseTo(-last.translateXPercent * 0.5, 6);
  });

  it('zooms out when zoomTo is smaller than zoomFrom', () => {
    const move = { zoomFrom: 1.3, zoomTo: 1 };

    expect(kenBurnsTransform({ frame: 100, durationInFrames: 101, move }).scale).toBeCloseTo(1, 6);
  });

  it('keeps the default image move a slow zoom in that never shrinks the picture', () => {
    expect(DEFAULT_IMAGE_KEN_BURNS.zoomFrom).toBe(1);
    expect(DEFAULT_IMAGE_KEN_BURNS.zoomTo).toBeGreaterThan(1);
  });
});

describe('kenBurnsCss', () => {
  it('emits a scale before the translate so the pan is measured in the scaled frame', () => {
    const css = kenBurnsCss({ scale: 1.1, translateXPercent: -2.4, translateYPercent: 1.2 });

    expect(css).toBe('scale(1.1) translate(-2.4%, 1.2%)');
  });
});
