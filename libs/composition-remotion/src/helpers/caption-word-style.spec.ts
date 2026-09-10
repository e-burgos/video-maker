import { describe, expect, it } from 'vitest';
import { CAPTION_PRESET_IDS, captionPreset } from './caption-preset';
import { captionWordStyle } from './caption-word-style';

const STATES = [
  { isEmphasis: false, isActive: false },
  { isEmphasis: true, isActive: false },
  { isEmphasis: false, isActive: true },
  { isEmphasis: true, isActive: true },
] as const;

describe.each(CAPTION_PRESET_IDS)('captionWordStyle — %s', (id) => {
  const preset = captionPreset(id);

  it('la palabra normal y la de impacto no producen estilos idénticos (CA-004)', () => {
    const normal = captionWordStyle(preset, { isEmphasis: false, isActive: false });
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false });

    expect(normal).not.toEqual(emphasis);
  });

  it('los cuatro estados producen cuatro estilos distintos de a pares (RN-13)', () => {
    const styles = STATES.map((state) => captionWordStyle(preset, state));

    for (let i = 0; i < styles.length; i += 1) {
      for (let j = i + 1; j < styles.length; j += 1) {
        expect(styles[i]).not.toEqual(styles[j]);
      }
    }
  });

  it('normal contra activa difieren aunque activeColor coincida con color (RN-14)', () => {
    const normal = captionWordStyle(preset, { isEmphasis: false, isActive: false });
    const active = captionWordStyle(preset, { isEmphasis: false, isActive: true });

    expect(normal).not.toEqual(active);
  });

  it('emphasis+active preserva el color y el peso de emphasis, sin ceder ante active (D-08, RN-14)', () => {
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false });
    const active = captionWordStyle(preset, { isEmphasis: false, isActive: true });
    const both = captionWordStyle(preset, { isEmphasis: true, isActive: true });

    expect(both.color).toBe(emphasis.color);
    expect(both.fontWeight).toBe(emphasis.fontWeight);
    expect(both.color).not.toBe(active.color);
  });

  it('la escala de emphasis+active es estrictamente mayor que la de cada estado por separado', () => {
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false });
    const active = captionWordStyle(preset, { isEmphasis: false, isActive: true });
    const both = captionWordStyle(preset, { isEmphasis: true, isActive: true });

    const scaleOf = (style: ReturnType<typeof captionWordStyle>): number =>
      Number(String(style.transform).replace('scale(', '').replace(')', ''));

    expect(scaleOf(both)).toBeGreaterThan(scaleOf(emphasis));
    expect(scaleOf(both)).toBeGreaterThan(scaleOf(active));
  });

  it('reserva en el layout el ancho extra del escalado: margenes proporcionales a la escala y al largo de la palabra (FIX-e-burgos-003-001)', () => {
    const preset = captionPreset('bold-impact');
    const normal = captionWordStyle(preset, { isEmphasis: false, isActive: false }, 8);
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false }, 8);
    const longer = captionWordStyle(preset, { isEmphasis: true, isActive: false }, 12);
    const both = captionWordStyle(preset, { isEmphasis: true, isActive: true }, 8);
    const marginOf = (style: ReturnType<typeof captionWordStyle>): number =>
      Number(String(style.marginLeft ?? '0em').replace('em', ''));

    expect('marginLeft' in normal).toBe(false);
    expect(marginOf(emphasis)).toBeGreaterThan(0);
    expect(emphasis.marginRight).toBe(emphasis.marginLeft);
    expect(marginOf(longer)).toBeGreaterThan(marginOf(emphasis));
    expect(marginOf(both)).toBeGreaterThan(marginOf(emphasis));
    expect(marginOf(emphasis)).toBeCloseTo(((preset.emphasisScale - 1) / 2) * 8 * (preset.averageCharWidthEm + preset.letterSpacingEm), 3);
  });

  it('nunca emite fontSize (D-12): lo pone el contenedor del clip', () => {
    for (const state of STATES) {
      const style = captionWordStyle(preset, state);
      expect('fontSize' in style).toBe(false);
    }
  });
});

describe('captionWordStyle — valores exactos de bold-impact (tabla D-08)', () => {
  const preset = captionPreset('bold-impact');

  it('normal', () => {
    const style = captionWordStyle(preset, { isEmphasis: false, isActive: false });

    expect(style.fontWeight).toBe(800);
    expect(style.color).toBe('#ffffff');
    expect(style.transform).toBe('scale(1)');
  });

  it('emphasis', () => {
    const style = captionWordStyle(preset, { isEmphasis: true, isActive: false });

    expect(style.fontWeight).toBe(900);
    expect(style.color).toBe('#ffe45e');
    expect(style.transform).toBe('scale(1.12)');
  });

  it('active', () => {
    const style = captionWordStyle(preset, { isEmphasis: false, isActive: true });

    expect(style.fontWeight).toBe(800);
    expect(style.color).toBe('#ffffff');
    expect(style.transform).toBe('scale(1.08)');
  });

  it('emphasis + active: la escala compone multiplicativamente con round3', () => {
    const style = captionWordStyle(preset, { isEmphasis: true, isActive: true });

    expect(style.fontWeight).toBe(900);
    expect(style.color).toBe('#ffe45e');
    expect(style.transform).toBe('scale(1.21)');
  });
});

describe('captionWordStyle — composición multiplicativa de la escala por preset', () => {
  it.each([
    ['bold-impact', 1.21],
    ['clean-sans', 1.145],
    ['outline-pop', 1.254],
    ['subtle-lower', 1.082],
  ] as const)('%s: emphasis+active compone a scale(%s)', (id, expectedScale) => {
    const preset = captionPreset(id);
    const style = captionWordStyle(preset, { isEmphasis: true, isActive: true });

    expect(style.transform).toBe(`scale(${expectedScale})`);
  });
});

describe('captionWordStyle — ramas condicionales de stroke/shadow/pill (R-7)', () => {
  it('bold-impact tiene stroke y shadow pero no pill', () => {
    const preset = captionPreset('bold-impact');
    const style = captionWordStyle(preset, { isEmphasis: false, isActive: false });

    expect(style.WebkitTextStroke).toBe('0.02em #000000');
    expect(style.paintOrder).toBe('stroke fill');
    expect(style.textShadow).toBe('0 0.04em 0.12em rgba(0, 0, 0, 0.85)');
    expect('backgroundColor' in style).toBe(false);
    expect('padding' in style).toBe(false);
    expect('borderRadius' in style).toBe(false);
  });

  it('clean-sans tiene shadow pero no stroke ni pill', () => {
    const preset = captionPreset('clean-sans');
    const style = captionWordStyle(preset, { isEmphasis: false, isActive: false });

    expect('WebkitTextStroke' in style).toBe(false);
    expect('paintOrder' in style).toBe(false);
    expect(style.textShadow).toBe('0 0.03em 0.1em rgba(0, 0, 0, 0.7)');
    expect('backgroundColor' in style).toBe(false);
  });

  it('subtle-lower (único con píldora) devuelve backgroundColor/padding/borderRadius y no tiene stroke ni shadow', () => {
    const preset = captionPreset('subtle-lower');

    const normal = captionWordStyle(preset, { isEmphasis: false, isActive: false });
    const emphasis = captionWordStyle(preset, { isEmphasis: true, isActive: false });

    expect('WebkitTextStroke' in normal).toBe(false);
    expect('textShadow' in normal).toBe(false);
    expect(normal.backgroundColor).toBe('rgba(0, 0, 0, 0.55)');
    expect(normal.padding).toBe('0.12em 0.35em');
    expect(normal.borderRadius).toBe('0.35em');
    expect(emphasis.backgroundColor).toBe('rgba(0, 0, 0, 0.78)');
  });
});
