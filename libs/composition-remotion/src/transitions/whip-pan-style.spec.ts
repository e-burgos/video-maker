import type { CSSProperties } from 'react';
import { describe, expect, it } from 'vitest';
import { whipPanStyle } from './whip-pan-style';

function blurPx(filter: CSSProperties['filter']): number {
  return Number.parseFloat(String(filter).replace('blur(', ''));
}

describe('whipPanStyle', () => {
  it('at progress 0, has no blur and leaves the exiting clip in place', () => {
    const style = whipPanStyle('from-left', 'exiting', 0);

    expect(blurPx(style.filter)).toBe(0);
    expect(style.transform).toBe('translateX(0%)');
  });

  it('at progress 0.5, reaches the maximum blur', () => {
    const style = whipPanStyle('from-left', 'exiting', 0.5, 24);

    expect(blurPx(style.filter)).toBeCloseTo(24);
  });

  it('at progress 1, settles the entering clip into place with no blur', () => {
    const style = whipPanStyle('from-left', 'entering', 1);

    expect(blurPx(style.filter)).toBeCloseTo(0);
    expect(style.transform).toBe('translateX(0%)');
  });

  it('starts the entering clip fully offset for from-left', () => {
    const style = whipPanStyle('from-left', 'entering', 0);

    expect(style.transform).toBe('translateX(-100%)');
  });

  it('moves along X and inverts sign between from-left and from-right', () => {
    const left = whipPanStyle('from-left', 'exiting', 1);
    const right = whipPanStyle('from-right', 'exiting', 1);

    expect(left.transform).toBe('translateX(100%)');
    expect(right.transform).toBe('translateX(-100%)');
  });

  it('moves along Y and inverts sign between from-top and from-bottom', () => {
    const top = whipPanStyle('from-top', 'exiting', 1);
    const bottom = whipPanStyle('from-bottom', 'exiting', 1);

    expect(top.transform).toBe('translateY(100%)');
    expect(bottom.transform).toBe('translateY(-100%)');
  });

  it('defaults maxBlurPx to 24 when omitted', () => {
    const withDefault = whipPanStyle('from-left', 'exiting', 0.5);
    const withExplicitDefault = whipPanStyle('from-left', 'exiting', 0.5, 24);

    expect(withDefault.filter).toBe(withExplicitDefault.filter);
  });

  it('scales the blur proportionally to a custom maxBlurPx', () => {
    const style = whipPanStyle('from-left', 'exiting', 0.5, 10);

    expect(blurPx(style.filter)).toBeCloseTo(10);
  });
});
