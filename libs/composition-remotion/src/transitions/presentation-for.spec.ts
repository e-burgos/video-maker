import { describe, expect, it } from 'vitest';
import { fade } from '@remotion/transitions/fade';
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

  it('degrades kind "light-leak" to the same presentation as fade()', () => {
    const presentation = presentationFor('light-leak', null);

    expect(presentation.component).toBe(fade().component);
  });

  it('defensively degrades an unknown kind to fade()', () => {
    const unknownKind = 'unknown-kind' as unknown as TransitionKind;

    const presentation = presentationFor(unknownKind, null);

    expect(presentation.component).toBe(fade().component);
  });
});
