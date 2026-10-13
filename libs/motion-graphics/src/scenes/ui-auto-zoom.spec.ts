import { describe, expect, it } from 'vitest';

import {
  autoZoomFocus,
  calloutRect,
  CAPTURE_PADDING,
  MAX_AUTO_SCALE,
  padRect,
  pointRect,
  POINT_RADIUS,
  squareAroundCenter,
  unionRects,
} from './ui-auto-zoom';

describe('geometry of the automatic framing', () => {
  it('turns a point into a small square around it', () => {
    expect(pointRect(0.5, 0.4)).toEqual({ x: 0.5 - POINT_RADIUS, y: 0.4 - POINT_RADIUS, w: POINT_RADIUS * 2, h: POINT_RADIUS * 2 });
  });

  it('unions rectangles and has nothing to union without them', () => {
    expect(unionRects([])).toBeNull();
    const union = unionRects([{ x: 0.1, y: 0.2, w: 0.1, h: 0.1 }, { x: 0.5, y: 0.6, w: 0.2, h: 0.1 }]);
    expect(union?.x).toBeCloseTo(0.1);
    expect(union?.y).toBeCloseTo(0.2);
    expect(union?.w).toBeCloseTo(0.6);
    expect(union?.h).toBeCloseTo(0.5);
  });

  it('pads every side and stays inside the capture', () => {
    const padded = padRect({ x: 0.3, y: 0.3, w: 0.2, h: 0.2 });
    expect(padded.x).toBeCloseTo(0.3 - CAPTURE_PADDING);
    expect(padded.w).toBeCloseTo(0.2 + 2 * CAPTURE_PADDING);
    expect(padRect({ x: 0.02, y: 0.9, w: 0.2, h: 0.1 })).toEqual({ x: 0, y: 0.9 - CAPTURE_PADDING, w: 0.2 + 0.02 + CAPTURE_PADDING, h: 1 - (0.9 - CAPTURE_PADDING) });
  });

  it('expands to the aspect of the visible frame: a square in capture fractions, centred and clamped inside', () => {
    expect(squareAroundCenter({ x: 0.4, y: 0.4, w: 0.2, h: 0.1 })).toEqual({ side: 0.2, cx: 0.5, cy: 0.45 });
    expect(squareAroundCenter({ x: 0, y: 0.8, w: 0.1, h: 0.2 })).toEqual({ side: 0.2, cx: 0.1, cy: 0.9 });
  });

  it('gives the callout bubble room by its placement', () => {
    const above = calloutRect(0.5, 0.5, 'Se cobra ahora', { horizontal: 'mid', vertical: 'above' });
    expect(above.y).toBeLessThan(0.4);
    expect(above.x).toBeLessThan(0.5);
    expect(above.x + above.w).toBeGreaterThan(0.5);
    const below = calloutRect(0.1, 0.1, 'Mirá', { horizontal: 'start', vertical: 'below' });
    expect(below.x).toBeCloseTo(0.07);
    expect(below.y + below.h).toBeGreaterThan(0.2);
    expect(calloutRect(0.9, 0.9, 'x'.repeat(200), { horizontal: 'end', vertical: 'above' }).w).toBeLessThanOrEqual(0.4 + POINT_RADIUS * 2);
  });
});

describe('autoZoomFocus', () => {
  it('has no framing without anything to frame', () => {
    expect(autoZoomFocus([])).toBeNull();
  });

  it('frames a compact area with its padding, centred on it', () => {
    const focus = autoZoomFocus([{ x: 0.3, y: 0.3, w: 0.4, h: 0.1 }]);
    expect(focus?.scale).toBeCloseTo(1 / 0.54);
    expect(focus?.cx).toBeCloseTo(0.5);
    expect(focus?.cy).toBeCloseTo(0.35);
  });

  it('caps the scale on tiny areas', () => {
    expect(autoZoomFocus([pointRect(0.5, 0.5)])?.scale).toBe(MAX_AUTO_SCALE);
  });

  it('skips the framing when the region is already 70% of the capture or more', () => {
    expect(autoZoomFocus([{ x: 0.1, y: 0.1, w: 0.58, h: 0.1 }])).toBeNull();
    expect(autoZoomFocus([{ x: 0.1, y: 0.1, w: 0.5, h: 0.1 }])?.scale).toBeCloseTo(1 / 0.64);
  });

  it('keeps the window inside the capture near the edges', () => {
    const focus = autoZoomFocus([pointRect(0.97, 0.97)]);
    expect(focus?.cx).toBeCloseTo(1 - 1 / MAX_AUTO_SCALE / 2);
    expect(focus?.cy).toBeCloseTo(1 - 1 / MAX_AUTO_SCALE / 2);
  });

  it('uses the tall side when the area is tall', () => {
    const focus = autoZoomFocus([{ x: 0.4, y: 0.2, w: 0.05, h: 0.4 }]);
    expect(focus?.scale).toBeCloseTo(1 / 0.54);
    expect(focus?.cy).toBeCloseTo(0.4);
  });
});
