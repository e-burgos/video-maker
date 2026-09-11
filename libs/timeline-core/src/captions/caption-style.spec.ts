import { describe, expect, it } from 'vitest';

import { CAPTION_STYLES, captionGroupingForStyle, isCaptionStyle } from './caption-style';

describe('caption-style (FIX-e-burgos-003-003)', () => {
  it('publica los cinco estilos, incluido off', () => {
    expect([...CAPTION_STYLES]).toEqual([
      'bold-impact',
      'clean-sans',
      'outline-pop',
      'subtle-lower',
      'off',
    ]);
  });

  it('isCaptionStyle acepta sólo los cinco valores', () => {
    expect(CAPTION_STYLES.every(isCaptionStyle)).toBe(true);
    expect(isCaptionStyle('neon')).toBe(false);
    expect(isCaptionStyle(3)).toBe(false);
  });

  it('subtle-lower agrupa como subtítulo: 6 a 10 palabras en 2 a 4 segundos', () => {
    expect(captionGroupingForStyle('subtle-lower')).toEqual({
      minWords: 6,
      maxWords: 10,
      minDurationMs: 2000,
      maxDurationMs: 4000,
      maxGapMs: 900,
    });
  });

  it('los demás estilos no pisan el agrupado del preset de montaje', () => {
    expect(captionGroupingForStyle('bold-impact')).toBeNull();
    expect(captionGroupingForStyle('clean-sans')).toBeNull();
    expect(captionGroupingForStyle('outline-pop')).toBeNull();
    expect(captionGroupingForStyle('off')).toBeNull();
    expect(captionGroupingForStyle(undefined)).toBeNull();
  });
});
