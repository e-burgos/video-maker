import type { LogoOverlay, OutputFormat } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { logoOverlayBox, logoOverlayStyle } from './logo-overlay-style';

const REELS: OutputFormat = { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 };

function logo(overrides: Partial<LogoOverlay> = {}): LogoOverlay {
  return {
    assetId: 'raw/logo/brand.png',
    position: 'bottom-right',
    widthRatio: 0.32,
    marginRatio: 0.035,
    opacity: 1,
    ...overrides,
  };
}

describe('logoOverlayBox', () => {
  it('el default cae abajo a la derecha con 32 % del ancho y 3,5 % de margen', () => {
    expect(logoOverlayBox(logo(), REELS)).toEqual({
      widthPx: 346,
      marginPx: 38,
      horizontal: 'right',
      vertical: 'bottom',
      opacity: 1,
    });
  });

  it('resuelve las cuatro esquinas', () => {
    expect(logoOverlayBox(logo({ position: 'top-left' }), REELS)).toMatchObject({
      horizontal: 'left',
      vertical: 'top',
    });
    expect(logoOverlayBox(logo({ position: 'top-right' }), REELS)).toMatchObject({
      horizontal: 'right',
      vertical: 'top',
    });
    expect(logoOverlayBox(logo({ position: 'bottom-left' }), REELS)).toMatchObject({
      horizontal: 'left',
      vertical: 'bottom',
    });
  });

  it('el margen se calcula sobre el ancho, así que es igual en los dos ejes', () => {
    const box = logoOverlayBox(logo({ marginRatio: 0.1 }), REELS);

    expect(box.marginPx).toBe(108);
  });

  it('nunca deja el logo fuera del cuadro: el ancho se recorta al espacio entre márgenes', () => {
    const box = logoOverlayBox(logo({ widthRatio: 1, marginRatio: 0.1 }), REELS);

    expect(box.widthPx).toBe(1080 - 2 * 108);
    expect(box.widthPx + 2 * box.marginPx).toBeLessThanOrEqual(REELS.width);
  });

  it('propaga la opacidad', () => {
    expect(logoOverlayBox(logo({ opacity: 0.4 }), REELS).opacity).toBe(0.4);
  });

  it('un formato 16x9 escala el logo con su propio ancho', () => {
    const youtube: OutputFormat = { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 };

    expect(logoOverlayBox(logo(), youtube)).toMatchObject({ widthPx: 614, marginPx: 67 });
  });
});

describe('logoOverlayStyle', () => {
  it('emite el estilo absoluto con la esquina que corresponde', () => {
    expect(logoOverlayStyle(logo(), REELS)).toEqual({
      position: 'absolute',
      right: 38,
      bottom: 38,
      width: 346,
      opacity: 1,
    });
  });

  it('la esquina superior izquierda emite left/top y nunca right/bottom', () => {
    const style = logoOverlayStyle(logo({ position: 'top-left' }), REELS);

    expect(style).toEqual({ position: 'absolute', left: 38, top: 38, width: 346, opacity: 1 });
    expect(style).not.toHaveProperty('right');
    expect(style).not.toHaveProperty('bottom');
  });
});
