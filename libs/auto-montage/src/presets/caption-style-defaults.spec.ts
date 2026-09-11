import { describe, expect, it } from 'vitest';

import {
  CAPTION_STYLE_BY_MONTAGE_PRESET,
  captionStyleForMontagePreset,
} from './caption-style-defaults';

describe('captionStyleForMontagePreset (FIX-e-burgos-003-003)', () => {
  it('educational usa subtítulo inferior y los otros tres el cinético actual', () => {
    expect(CAPTION_STYLE_BY_MONTAGE_PRESET).toEqual({
      'software-demo': 'bold-impact',
      hardware: 'bold-impact',
      recipe: 'bold-impact',
      educational: 'subtle-lower',
    });
  });

  it('un estilo explícito gana sobre el default del preset', () => {
    expect(captionStyleForMontagePreset('educational', 'bold-impact')).toBe('bold-impact');
    expect(captionStyleForMontagePreset('software-demo', 'off')).toBe('off');
  });

  it('sin estilo explícito cae al default del preset', () => {
    expect(captionStyleForMontagePreset('educational', undefined)).toBe('subtle-lower');
    expect(captionStyleForMontagePreset('software-demo', undefined)).toBe('bold-impact');
  });
});
