import { describe, expect, it } from 'vitest';
import { defaultFormat } from '@video-maker/timeline-core';
import { CAPTION_PRESET_IDS, captionPreset } from './caption-preset';
import { captionSafeZone } from './caption-safe-zone';
import { captionBoxFor } from './caption-box';

describe.each(CAPTION_PRESET_IDS)('captionBoxFor sobre tiktok-9x16 (%s)', (id) => {
  const format = defaultFormat('tiktok-9x16');
  const safeZone = captionSafeZone(format, 'tiktok');
  const preset = captionPreset(id);
  const availableWidth = format.width - safeZone.left - safeZone.right;
  const availableHeight = format.height - safeZone.top - safeZone.bottom;
  const expectedHeight = Math.round(format.height * preset.boxHeightRatio);

  it('produce tres cajas distintas contenidas en el safe zone, con el alto del preset (CA-003)', () => {
    const top = captionBoxFor(safeZone, format, preset, 'top');
    const center = captionBoxFor(safeZone, format, preset, 'center');
    const bottom = captionBoxFor(safeZone, format, preset, 'bottom');

    for (const box of [top, center, bottom]) {
      expect(box.height).toBe(expectedHeight);
      expect(box.x).toBe(safeZone.left);
      expect(box.width).toBe(availableWidth);
      expect(box.y).toBeGreaterThanOrEqual(safeZone.top);
      expect(box.y + box.height).toBeLessThanOrEqual(safeZone.top + availableHeight);
    }

    expect(top.y).toBeLessThan(center.y);
    expect(center.y).toBeLessThan(bottom.y);
  });

  it('deja la caja dentro de 1080x1920 (CA-002)', () => {
    const box = captionBoxFor(safeZone, format, preset, 'center');

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1080);
    expect(box.y + box.height).toBeLessThanOrEqual(1920);
  });
});

describe('captionBoxFor — valores exactos de tiktok-9x16 + tiktok (verificación numérica del architect)', () => {
  const format = defaultFormat('tiktok-9x16');
  const safeZone = captionSafeZone(format, 'tiktok');

  it.each([
    ['bold-impact', 461, 280, 610, 939],
    ['clean-sans', 346, 280, 667, 1054],
    ['outline-pop', 422, 280, 629, 978],
    ['subtle-lower', 154, 280, 763, 1246],
  ] as const)('%s: height=%i, top=%i, center=%i, bottom=%i', (id, height, top, center, bottom) => {
    const preset = captionPreset(id);

    expect(captionBoxFor(safeZone, format, preset, 'top')).toEqual({
      x: 60,
      y: top,
      width: 700,
      height,
    });
    expect(captionBoxFor(safeZone, format, preset, 'center')).toEqual({
      x: 60,
      y: center,
      width: 700,
      height,
    });
    expect(captionBoxFor(safeZone, format, preset, 'bottom')).toEqual({
      x: 60,
      y: bottom,
      width: 700,
      height,
    });
  });
});

describe('captionBoxFor — anchor por defecto', () => {
  it('usa preset.anchor cuando no se pasa un cuarto parámetro', () => {
    const format = defaultFormat('reels-9x16');
    const safeZone = captionSafeZone(format);
    const preset = captionPreset('subtle-lower');

    expect(captionBoxFor(safeZone, format, preset)).toEqual(
      captionBoxFor(safeZone, format, preset, preset.anchor),
    );
  });
});

describe('captionBoxFor — formato 16:9', () => {
  it('contiene la caja dentro de youtube-16x9 con la plataforma youtube-landscape', () => {
    const format = defaultFormat('youtube-16x9');
    const safeZone = captionSafeZone(format, 'youtube-landscape');
    const preset = captionPreset('clean-sans');

    const box = captionBoxFor(safeZone, format, preset, 'bottom');

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(format.width);
    expect(box.y + box.height).toBeLessThanOrEqual(format.height);
    expect(box.height).toBe(Math.round(format.height * preset.boxHeightRatio));
  });
});

describe.each([
  ['reels-9x16', 'instagram-reels'],
  ['tiktok-9x16', 'tiktok'],
  ['shorts-9x16', 'youtube-shorts'],
] as const)(
  'captionBoxFor — contención en los tres formatos 9:16 (%s / %s)',
  (formatPreset, platform) => {
    const format = defaultFormat(formatPreset);
    const safeZone = captionSafeZone(format, platform);

    it.each(CAPTION_PRESET_IDS)(
      '%s deja las tres cajas dentro de 1080x1920 y del safe zone (CA-002)',
      (id) => {
        const preset = captionPreset(id);

        for (const anchor of ['top', 'center', 'bottom'] as const) {
          const box = captionBoxFor(safeZone, format, preset, anchor);

          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(1080);
          expect(box.y + box.height).toBeLessThanOrEqual(1920);
          expect(box.y).toBeGreaterThanOrEqual(safeZone.top);
          expect(box.y + box.height).toBeLessThanOrEqual(format.height - safeZone.bottom);
        }
      },
    );
  },
);
