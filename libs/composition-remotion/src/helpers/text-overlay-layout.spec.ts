import { describe, expect, it } from 'vitest';
import { defaultFormat, safeZoneFor } from '@video-maker/timeline-core';
import { textOverlayLayout, withAlpha } from './text-overlay-layout';

const LANDSCAPE = defaultFormat('youtube-16x9');
const PORTRAIT = defaultFormat('reels-9x16');

describe('textOverlayLayout', () => {
  it('un lower third va al margen inferior izquierdo, dentro de la zona segura y angosto', () => {
    const layout = textOverlayLayout({
      kind: 'lower-third',
      placement: 'bottom-left',
      format: LANDSCAPE,
      safeZone: safeZoneFor(LANDSCAPE),
      reserveCaptionBand: false,
    });
    expect(layout.box).toMatchObject({ position: 'absolute', left: 82, bottom: 82, maxWidth: 691 });
    expect(layout).toMatchObject({ align: 'left', slideFrom: 'left', unit: 1080 });
  });

  it('con subtítulos abajo sube por encima de la banda de subtítulos', () => {
    const layout = textOverlayLayout({
      kind: 'lower-third',
      placement: 'bottom-right',
      format: LANDSCAPE,
      safeZone: safeZoneFor(LANDSCAPE),
      reserveCaptionBand: true,
    });
    expect(layout.box).toMatchObject({ right: 82, bottom: 82 + 216 });
    expect(layout.slideFrom).toBe('right');
  });

  it('centrado arriba ocupa un ancho fijo centrado y entra desde arriba', () => {
    const layout = textOverlayLayout({
      kind: 'kinetic-text',
      placement: 'top-center',
      format: PORTRAIT,
      safeZone: safeZoneFor(PORTRAIT),
      reserveCaptionBand: false,
    });
    expect(layout.box).toMatchObject({ top: 220 + 22, width: 648, left: 216 });
    expect(layout).toMatchObject({ align: 'center', slideFrom: 'up' });
  });
});

describe('withAlpha', () => {
  it('suma el canal alfa en hexadecimal', () => {
    expect(withAlpha('#0f172a', 0.9)).toBe('#0f172ae6');
    expect(withAlpha('#ffffff', 2)).toBe('#ffffffff');
  });
});
