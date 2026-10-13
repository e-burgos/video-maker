import { describe, expect, it } from 'vitest';

import { cameraKeyframes, focusOn, focusWindow, FOCUS_PADDING, MIN_FOCUS_SIDE, padRect, pointRect, POINT_RADIUS, unionRects, windowOverlap } from './ui-auto-zoom';

describe('geometry of the camera', () => {
  it('turns a point into a small square around it', () => {
    expect(pointRect(0.5, 0.4)).toEqual({ x: 0.5 - POINT_RADIUS, y: 0.4 - POINT_RADIUS, w: POINT_RADIUS * 2, h: POINT_RADIUS * 2 });
  });

  it('unions rectangles and has nothing to union without them', () => {
    expect(unionRects([])).toBeNull();
    const union = unionRects([{ x: 0.1, y: 0.2, w: 0.1, h: 0.1 }, { x: 0.5, y: 0.6, w: 0.2, h: 0.1 }]);
    expect(union?.w).toBeCloseTo(0.6);
    expect(union?.h).toBeCloseTo(0.5);
  });

  it('pads every side and stays inside the capture', () => {
    const padded = padRect({ x: 0.3, y: 0.3, w: 0.2, h: 0.2 });
    expect(padded.x).toBeCloseTo(0.3 - FOCUS_PADDING);
    expect(padded.w).toBeCloseTo(0.2 + 2 * FOCUS_PADDING);
    expect(padRect({ x: 0.02, y: 0.9, w: 0.2, h: 0.1 }).x).toBe(0);
    expect(padRect({ x: 0.02, y: 0.9, w: 0.2, h: 0.1 }).y + padRect({ x: 0.02, y: 0.9, w: 0.2, h: 0.1 }).h).toBe(1);
  });
});

describe('focusOn', () => {
  it('centres a small target with the minimum side, capping the scale', () => {
    const focus = focusOn(pointRect(0.5, 0.5));
    expect(focus.scale).toBeCloseTo(1 / MIN_FOCUS_SIDE);
    expect(focus.cx).toBeCloseTo(0.5);
    expect(focus.cy).toBeCloseTo(0.5);
  });

  it('uses the capture aspect: the side is the larger padded dimension', () => {
    expect(focusOn({ x: 0.2, y: 0.4, w: 0.3, h: 0.1 }).scale).toBeCloseTo(1 / 0.46);
    expect(focusOn({ x: 0.4, y: 0.1, w: 0.05, h: 0.4 }).scale).toBeCloseTo(1 / 0.56);
  });

  it('keeps the window inside the capture near the edges', () => {
    const focus = focusOn(pointRect(0.98, 0.02));
    const window = focusWindow(focus);
    expect(window.x + window.w).toBeCloseTo(1);
    expect(window.y).toBeCloseTo(0);
  });

  it('falls back to the full capture when the step needs almost all of it', () => {
    expect(focusOn({ x: 0.05, y: 0.4, w: 0.9, h: 0.05 })).toEqual({ scale: 1, cx: 0.5, cy: 0.5 });
    expect(focusOn({ x: 0.1, y: 0.4, w: 0.6, h: 0.05 }).scale).toBeGreaterThan(1);
  });
});

describe('cameraKeyframes', () => {
  it('gives distant steps their own keyframes in order', () => {
    const [a, b] = cameraKeyframes([pointRect(0.15, 0.15), pointRect(0.85, 0.85)]);
    expect(a).not.toEqual(b);
    expect(a.cx).toBeLessThan(b.cx);
  });

  it('shares one keyframe between consecutive steps that overlap strongly', () => {
    const [a, b] = cameraKeyframes([pointRect(0.5, 0.5), pointRect(0.55, 0.52)]);
    expect(a).toEqual(b);
  });

  it('does not mix a full view with a zoomed one even when they overlap', () => {
    const [a, b] = cameraKeyframes([{ x: 0.02, y: 0.4, w: 0.96, h: 0.05 }, pointRect(0.5, 0.45)]);
    expect(a.scale).toBe(1);
    expect(b.scale).toBeGreaterThan(1);
  });

  it('keeps a tight step apart from a wide one that contains it', () => {
    const [wide, tight] = cameraKeyframes([{ x: 0.1, y: 0.4, w: 0.6, h: 0.05 }, pointRect(0.5, 0.42)]);
    expect(tight.scale).toBeGreaterThan(wide.scale * 1.5);
  });

  it('measures overlap against the smaller window', () => {
    const a = focusOn(pointRect(0.5, 0.5));
    expect(windowOverlap(a, a)).toBeCloseTo(1);
    expect(windowOverlap(focusOn(pointRect(0.2, 0.2)), focusOn(pointRect(0.8, 0.8)))).toBe(0);
    expect(cameraKeyframes([])).toEqual([]);
  });
});
