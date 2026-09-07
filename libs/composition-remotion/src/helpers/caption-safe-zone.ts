import { safeZoneFor } from '@video-maker/timeline-core';
import type { OutputFormat, SafeZone } from '@video-maker/timeline-core';

export type CaptionPlatform =
  | 'instagram-reels'
  | 'tiktok'
  | 'youtube-shorts'
  | 'youtube-landscape';

export const CAPTION_PLATFORMS: readonly CaptionPlatform[] = [
  'instagram-reels',
  'tiktok',
  'youtube-shorts',
  'youtube-landscape',
];

export interface CaptionChromeReference {
  width: number;
  height: number;
}

export interface CaptionChromeInsets {
  reference: CaptionChromeReference;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const PORTRAIT_CHROME_REFERENCE: CaptionChromeReference = { width: 1080, height: 1920 };
const LANDSCAPE_CHROME_REFERENCE: CaptionChromeReference = { width: 1920, height: 1080 };

const NO_CHROME_INSETS: CaptionChromeInsets = {
  reference: PORTRAIT_CHROME_REFERENCE,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const CAPTION_CHROME_INSETS: Record<CaptionPlatform, CaptionChromeInsets> = {
  'instagram-reels': {
    reference: PORTRAIT_CHROME_REFERENCE,
    top: 40,
    bottom: 200,
    left: 0,
    right: 140,
  },
  tiktok: {
    reference: PORTRAIT_CHROME_REFERENCE,
    top: 60,
    bottom: 120,
    left: 0,
    right: 180,
  },
  'youtube-shorts': {
    reference: PORTRAIT_CHROME_REFERENCE,
    top: 40,
    bottom: 260,
    left: 0,
    right: 130,
  },
  'youtube-landscape': {
    reference: LANDSCAPE_CHROME_REFERENCE,
    top: 60,
    bottom: 120,
    left: 0,
    right: 0,
  },
};

export function captionChromeInsets(platform?: CaptionPlatform): CaptionChromeInsets {
  if (platform === undefined) {
    return NO_CHROME_INSETS;
  }

  return CAPTION_CHROME_INSETS[platform] ?? NO_CHROME_INSETS;
}

export function captionSafeZone(
  format: OutputFormat,
  platform?: CaptionPlatform,
  baseSafeZone?: SafeZone,
): SafeZone {
  const base = baseSafeZone ?? safeZoneFor(format);
  const insets = captionChromeInsets(platform);
  const scaleX = format.width / insets.reference.width;
  const scaleY = format.height / insets.reference.height;

  return {
    top: base.top + Math.round(insets.top * scaleY),
    bottom: base.bottom + Math.round(insets.bottom * scaleY),
    left: base.left + Math.round(insets.left * scaleX),
    right: base.right + Math.round(insets.right * scaleX),
  };
}
