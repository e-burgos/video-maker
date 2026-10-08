import { describe, expect, it } from 'vitest';
import type { CaptionTheme } from '@video-maker/timeline-core';

import { brandCaptionPreset } from './brand-caption-preset';
import { captionWordStyle } from './caption-word-style';

const theme: CaptionTheme = {
  fontFamily: 'Outfit',
  fontFiles: [{ path: 'work/brand/fonts/outfit.woff2', weight: '100 900' }],
  textColor: '#fafafa',
  accentColor: '#0ea5e9',
  boxColor: '#09090b',
};

describe('brandCaptionPreset', () => {
  const preset = brandCaptionPreset(theme);

  it('usa la familia de la marca con respaldo genérico', () => {
    expect(preset.fontFamily).toBe("'Outfit', sans-serif");
  });

  it('pinta el texto, la palabra de impacto y la caja con los colores de la marca', () => {
    expect(captionWordStyle(preset, { isEmphasis: false, isActive: false }).color).toBe('#fafafa');
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false });
    expect(emphasis.color).toBe('#0ea5e9');
    expect(emphasis.backgroundColor).toBe('#09090b');
  });
});
