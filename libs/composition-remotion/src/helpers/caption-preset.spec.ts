import { describe, expect, it } from 'vitest';
import type { CaptionPresetId } from './caption-preset';
import {
  CAPTION_PRESETS,
  CAPTION_PRESET_IDS,
  DEFAULT_CAPTION_PRESET_ID,
  captionPreset,
} from './caption-preset';

const FONT_FAMILY_GENERIC_FALLBACK = /(?:^|,\s*)(sans-serif|serif)$/;

describe('CAPTION_PRESET_IDS', () => {
  it('registra al menos cuatro estilos de subtítulos (RN-1, CA-004)', () => {
    expect(CAPTION_PRESET_IDS.length).toBeGreaterThanOrEqual(4);
  });

  it('cada id del registro tiene una entrada correspondiente en CAPTION_PRESETS', () => {
    for (const id of CAPTION_PRESET_IDS) {
      expect(CAPTION_PRESETS[id].id).toBe(id);
    }
  });
});

describe.each(CAPTION_PRESET_IDS)('CAPTION_PRESETS[%s]', (id) => {
  const preset = CAPTION_PRESETS[id];

  it('declara una familia con respaldo genérico del sistema operativo (RN-2)', () => {
    expect(preset.fontFamily).toMatch(FONT_FAMILY_GENERIC_FALLBACK);
  });

  it('distingue la palabra de impacto de la normal en peso y en color (RN-3, CA-004)', () => {
    expect(preset.emphasisFontWeight).not.toBe(preset.fontWeight);
    expect(preset.emphasisColor).not.toBe(preset.color);
  });

  it('escala la palabra activa y la de impacto por encima de la normal', () => {
    expect(preset.activeScale).toBeGreaterThan(1);
    expect(preset.emphasisScale).toBeGreaterThan(1);
  });

  it('define un rango de tamaño de fuente válido', () => {
    expect(preset.maxFontSizeRatio).toBeGreaterThan(preset.minFontSizeRatio);
    expect(preset.minFontSizeRatio).toBeGreaterThan(0);
    expect(preset.minFontSizeRatio).toBeLessThan(1);
    expect(preset.maxFontSizeRatio).toBeGreaterThan(0);
    expect(preset.maxFontSizeRatio).toBeLessThan(1);
  });

  it('define proporciones de caja dentro de su rango válido', () => {
    expect(preset.sidePaddingRatio).toBeGreaterThanOrEqual(0);
    expect(preset.sidePaddingRatio).toBeLessThan(0.5);
    expect(preset.boxHeightRatio).toBeGreaterThan(0);
    expect(preset.boxHeightRatio).toBeLessThanOrEqual(1);
  });
});

describe('captionPreset', () => {
  it('devuelve bold-impact por defecto sin argumentos', () => {
    expect(captionPreset()).toBe(CAPTION_PRESETS[DEFAULT_CAPTION_PRESET_ID]);
  });

  it('devuelve el preset pedido cuando el id existe', () => {
    expect(captionPreset('subtle-lower')).toBe(CAPTION_PRESETS['subtle-lower']);
  });

  it('cae al preset por defecto ante un id desconocido (CE-1)', () => {
    expect(captionPreset('neon' as CaptionPresetId)).toBe(
      CAPTION_PRESETS[DEFAULT_CAPTION_PRESET_ID],
    );
  });
});
