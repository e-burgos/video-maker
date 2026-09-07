import { describe, expect, it } from 'vitest';
import { defaultFormat, safeZoneFor } from '@video-maker/timeline-core';
import type { SafeZone } from '@video-maker/timeline-core';
import type { CaptionPlatform } from './caption-safe-zone';
import { CAPTION_PLATFORMS, captionChromeInsets, captionSafeZone } from './caption-safe-zone';
import { captionLayout } from './caption-layout';

describe('captionChromeInsets', () => {
  it('sin plataforma da los cuatro insets en cero', () => {
    expect(captionChromeInsets()).toEqual({
      reference: { width: 1080, height: 1920 },
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('cae a insets en cero ante una plataforma no soportada (CE-2)', () => {
    expect(captionChromeInsets('vimeo' as CaptionPlatform)).toEqual(captionChromeInsets());
  });

  it('cubre las cuatro plataformas soportadas con sus insets exactos', () => {
    expect(CAPTION_PLATFORMS).toHaveLength(4);

    expect(captionChromeInsets('instagram-reels')).toEqual({
      reference: { width: 1080, height: 1920 },
      top: 40,
      bottom: 200,
      left: 0,
      right: 140,
    });
    expect(captionChromeInsets('tiktok')).toEqual({
      reference: { width: 1080, height: 1920 },
      top: 60,
      bottom: 120,
      left: 0,
      right: 180,
    });
    expect(captionChromeInsets('youtube-shorts')).toEqual({
      reference: { width: 1080, height: 1920 },
      top: 40,
      bottom: 260,
      left: 0,
      right: 130,
    });
    expect(captionChromeInsets('youtube-landscape')).toEqual({
      reference: { width: 1920, height: 1080 },
      top: 60,
      bottom: 120,
      left: 0,
      right: 0,
    });
  });

  it('reserva al menos 150 px adicionales del lado derecho en tiktok (CA-002)', () => {
    expect(captionChromeInsets('tiktok').right).toBe(180);
    expect(captionChromeInsets('tiktok').right).toBeGreaterThanOrEqual(150);
  });
});

describe('captionSafeZone', () => {
  it('sin plataforma es exactamente la identidad de safeZoneFor(format) (RN-5, CA-001)', () => {
    const format = defaultFormat('reels-9x16');

    expect(captionSafeZone(format)).toEqual(safeZoneFor(format));
  });

  it('con una plataforma nunca reduce ningún lado del safe zone base (RN-4, CA-001)', () => {
    const format = defaultFormat('tiktok-9x16');
    const base = safeZoneFor(format);

    const result = captionSafeZone(format, 'tiktok');

    expect(result.top).toBeGreaterThanOrEqual(base.top);
    expect(result.bottom).toBeGreaterThanOrEqual(base.bottom);
    expect(result.left).toBeGreaterThanOrEqual(base.left);
    expect(result.right).toBeGreaterThanOrEqual(base.right);
  });

  it('da los safe zones exactos de la tabla del architect para las cuatro plataformas', () => {
    expect(captionSafeZone(defaultFormat('reels-9x16'))).toEqual({
      top: 220,
      bottom: 400,
      left: 60,
      right: 140,
    });
    expect(captionSafeZone(defaultFormat('reels-9x16'), 'instagram-reels')).toEqual({
      top: 260,
      bottom: 600,
      left: 60,
      right: 280,
    });
    expect(captionSafeZone(defaultFormat('tiktok-9x16'), 'tiktok')).toEqual({
      top: 280,
      bottom: 520,
      left: 60,
      right: 320,
    });
    expect(captionSafeZone(defaultFormat('shorts-9x16'), 'youtube-shorts')).toEqual({
      top: 260,
      bottom: 660,
      left: 60,
      right: 270,
    });
    expect(captionSafeZone(defaultFormat('youtube-16x9'), 'youtube-landscape')).toEqual({
      top: 120,
      bottom: 180,
      left: 60,
      right: 60,
    });
  });

  it.each<[string, CaptionPlatform]>([
    ['reels-9x16', 'instagram-reels'],
    ['tiktok-9x16', 'tiktok'],
    ['shorts-9x16', 'youtube-shorts'],
  ])(
    'deja la caja de captions dentro de 1080x1920 para %s / %s (CA-002)',
    (preset, platform) => {
      const format = defaultFormat(preset as Parameters<typeof defaultFormat>[0]);
      const safeZone = captionSafeZone(format, platform);
      const box = captionLayout(safeZone, format);

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(format.width);
      expect(box.y + box.height).toBeLessThanOrEqual(format.height);
    },
  );

  it('trata una plataforma no soportada como ausencia de plataforma (CE-2)', () => {
    const format = defaultFormat('reels-9x16');

    expect(captionSafeZone(format, 'vimeo' as CaptionPlatform)).toEqual(captionSafeZone(format));
  });

  it('respeta un baseSafeZone explícito en vez del default de safeZoneFor', () => {
    const format = defaultFormat('tiktok-9x16');
    const customBase: SafeZone = { top: 10, bottom: 20, left: 30, right: 40 };

    const result = captionSafeZone(format, 'tiktok', customBase);

    expect(result).toEqual({ top: 70, bottom: 140, left: 30, right: 220 });
  });

  it('devuelve siempre un objeto nuevo, nunca el baseSafeZone recibido', () => {
    const format = defaultFormat('reels-9x16');
    const customBase: SafeZone = { top: 10, bottom: 20, left: 30, right: 40 };

    const result = captionSafeZone(format, undefined, customBase);

    expect(result).not.toBe(customBase);
  });
});
