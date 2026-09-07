import { describe, expect, it } from 'vitest';

import { defaultFormat, safeZoneFor } from './format';

describe('defaultFormat', () => {
  it.each(['reels-9x16', 'tiktok-9x16', 'shorts-9x16'] as const)('devuelve 1080x1920@30 para %s', (preset) => {
    expect(defaultFormat(preset)).toEqual({ preset, width: 1080, height: 1920, fps: 30 });
  });

  it('devuelve 1920x1080@30 para youtube-16x9', () => {
    expect(defaultFormat('youtube-16x9')).toEqual({ preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 });
  });
});

describe('safeZoneFor', () => {
  it.each(['reels-9x16', 'tiktok-9x16', 'shorts-9x16'] as const)('devuelve los márgenes 9:16 para %s', (preset) => {
    expect(safeZoneFor(defaultFormat(preset))).toEqual({ top: 220, bottom: 400, left: 60, right: 140 });
  });

  it('devuelve 60px en todos los márgenes para youtube-16x9', () => {
    expect(safeZoneFor(defaultFormat('youtube-16x9'))).toEqual({ top: 60, bottom: 60, left: 60, right: 60 });
  });

  it('decide por el preset y no por las dimensiones del formato', () => {
    const customPortraitYoutube = { preset: 'youtube-16x9' as const, width: 1080, height: 1920, fps: 30 };
    expect(safeZoneFor(customPortraitYoutube)).toEqual({ top: 60, bottom: 60, left: 60, right: 60 });
  });
});
