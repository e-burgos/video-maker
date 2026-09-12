import { describe, expect, it } from 'vitest';

import { defaultFormat } from '../format/format';
import {
  LANDSCAPE_LOGO_WIDTH_RATIO,
  PORTRAIT_LOGO_WIDTH_RATIO,
  defaultLogoWidthRatio,
} from './logo-defaults';

describe('defaultLogoWidthRatio (FIX-006-001)', () => {
  it('reserva menos ancho en un cuadro apaisado que en uno vertical', () => {
    expect(LANDSCAPE_LOGO_WIDTH_RATIO).toBeLessThan(PORTRAIT_LOGO_WIDTH_RATIO);
  });

  it('devuelve 0.18 en 16:9', () => {
    expect(defaultLogoWidthRatio(defaultFormat('youtube-16x9'))).toBe(0.18);
  });

  it('devuelve 0.28 en los verticales', () => {
    for (const preset of ['reels-9x16', 'tiktok-9x16', 'shorts-9x16'] as const) {
      expect(defaultLogoWidthRatio(defaultFormat(preset))).toBe(0.28);
    }
  });

  it('trata el cuadrado como apaisado', () => {
    expect(defaultLogoWidthRatio({ ...defaultFormat('youtube-16x9'), width: 1080, height: 1080 })).toBe(
      LANDSCAPE_LOGO_WIDTH_RATIO,
    );
  });
});
