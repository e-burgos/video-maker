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

  it('declara una animación con spring y duración de entrada válidos (D-14, CA-006)', () => {
    expect(['pop', 'rise', 'fade']).toContain(preset.animation.mode);
    expect(preset.animation.spring.damping).toBeGreaterThan(0);
    expect(preset.animation.spring.mass).toBeGreaterThan(0);
    expect(preset.animation.spring.stiffness).toBeGreaterThan(0);
    expect(preset.animation.enterDurationFrames).toBeGreaterThan(0);
  });

  it('declara los campos propios de su modo, y solo esos (D-15)', () => {
    if (preset.animation.mode === 'pop') {
      expect(preset.animation.enterScale).toBeGreaterThan(0);
      expect(preset.animation.enterScale).toBeLessThan(1);
    }

    if (preset.animation.mode === 'rise') {
      expect(preset.animation.riseDistanceEm).toBeGreaterThan(0);
    }
  });
});

describe('animation de CAPTION_PRESETS', () => {
  it('cubre los tres modos, con al menos un pop, un rise y un fade (§3.3)', () => {
    const modes = CAPTION_PRESET_IDS.map((id) => CAPTION_PRESETS[id].animation.mode);

    expect(modes).toContain('pop');
    expect(modes).toContain('rise');
    expect(modes).toContain('fade');
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
