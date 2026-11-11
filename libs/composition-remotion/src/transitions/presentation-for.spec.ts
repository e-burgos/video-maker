import { describe, expect, it } from 'vitest';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { fade } from '@remotion/transitions/fade';
import { flip } from '@remotion/transitions/flip';
import { lightLeak } from './light-leak';
import { presentationFor } from './presentation-for';
import type { TransitionKind } from '../helpers/timeline-types';

describe('presentationFor', () => {
  it('returns fade() for kind "fade"', () => {
    const presentation = presentationFor('fade', null);

    expect(presentation.component).toBeDefined();
    expect(presentation.component).toBe(fade().component);
  });

  it('returns slide({ direction }) for kind "slide" with a direction', () => {
    const presentation = presentationFor('slide', 'from-left');

    expect(presentation.component).toBeDefined();
    expect(presentation.props).toEqual({ direction: 'from-left' });
  });

  it('returns slide() with no props for kind "slide" without a direction', () => {
    const presentation = presentationFor('slide', null);

    expect(presentation.component).toBeDefined();
    expect(presentation.props).toEqual({});
  });

  it('returns a whipPan presentation for kind "whip-pan" with a direction', () => {
    const presentation = presentationFor('whip-pan', 'from-top');

    expect(presentation.component).toBeDefined();
    expect(presentation.props).toEqual({ direction: 'from-top' });
  });

  it('defaults whip-pan direction to "from-right" when none is given', () => {
    const presentation = presentationFor('whip-pan', null);

    expect(presentation.props).toEqual({ direction: 'from-right' });
  });

  it('returns the light-leak presentation, not fade(), for kind "light-leak"', () => {
    const presentation = presentationFor('light-leak', null);

    expect(presentation.component).toBe(lightLeak().component);
    expect(presentation.component).not.toBe(fade().component);
  });

  it('returns wipe and flip with the timeline direction', () => {
    expect(presentationFor('wipe', 'from-top').props).toEqual({ direction: 'from-top' });
    expect(presentationFor('wipe', null).props).toEqual({});
    expect(presentationFor('flip', 'from-left').props).toEqual({ direction: 'from-left' });
    expect(presentationFor('flip', null).component).toBe(flip().component);
  });

  it('sizes clock-wipe and iris to the composition frame', () => {
    const vertical = { width: 1080, height: 1920 };

    expect(presentationFor('clock-wipe', null, vertical).props).toEqual(vertical);
    expect(presentationFor('clock-wipe', null, vertical).component).toBe(clockWipe(vertical).component);
    expect(presentationFor('iris', 'from-left', vertical).props).toEqual(vertical);
    expect(presentationFor('iris', null).props).toEqual({ width: 1920, height: 1080 });
  });

  it('defensively degrades an unknown kind to fade()', () => {
    const unknownKind = 'unknown-kind' as unknown as TransitionKind;

    const presentation = presentationFor(unknownKind, null);

    expect(presentation.component).toBe(fade().component);
  });
});
