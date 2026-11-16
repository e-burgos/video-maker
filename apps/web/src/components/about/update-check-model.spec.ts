import { describe, expect, it } from 'vitest';

import { formatPublishedDate, isSafeDownloadUrl } from './update-check-model';

describe('isSafeDownloadUrl', () => {
  it('accepts http and https urls only', () => {
    expect(isSafeDownloadUrl('https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg')).toBe(true);
    expect(isSafeDownloadUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeDownloadUrl(undefined)).toBe(false);
  });
});

describe('formatPublishedDate', () => {
  it('formats a valid iso date in the given locale', () => {
    expect(formatPublishedDate('2026-11-13T12:00:00.000Z', 'es')).toContain('2026');
  });

  it('returns null for missing or invalid dates', () => {
    expect(formatPublishedDate(undefined, 'es')).toBeNull();
    expect(formatPublishedDate('not a date', 'es')).toBeNull();
  });
});
