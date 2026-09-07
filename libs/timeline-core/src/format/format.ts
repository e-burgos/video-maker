import type { OutputFormat, OutputPreset, SafeZone } from '../schemas/output-format.schema';

const PORTRAIT_9X16_FORMAT: Omit<OutputFormat, 'preset'> = { width: 1080, height: 1920, fps: 30 };
const LANDSCAPE_16X9_FORMAT: Omit<OutputFormat, 'preset'> = { width: 1920, height: 1080, fps: 30 };

const PORTRAIT_9X16_SAFE_ZONE: SafeZone = { top: 220, bottom: 400, left: 60, right: 140 };
const LANDSCAPE_16X9_SAFE_ZONE: SafeZone = { top: 60, bottom: 60, left: 60, right: 60 };

export const DEFAULT_SAFE_ZONES: Record<OutputPreset, SafeZone> = {
  'reels-9x16': PORTRAIT_9X16_SAFE_ZONE,
  'tiktok-9x16': PORTRAIT_9X16_SAFE_ZONE,
  'shorts-9x16': PORTRAIT_9X16_SAFE_ZONE,
  'youtube-16x9': LANDSCAPE_16X9_SAFE_ZONE,
};

const DEFAULT_DIMENSIONS: Record<OutputPreset, Omit<OutputFormat, 'preset'>> = {
  'reels-9x16': PORTRAIT_9X16_FORMAT,
  'tiktok-9x16': PORTRAIT_9X16_FORMAT,
  'shorts-9x16': PORTRAIT_9X16_FORMAT,
  'youtube-16x9': LANDSCAPE_16X9_FORMAT,
};

export function defaultFormat(preset: OutputPreset): OutputFormat {
  return { preset, ...DEFAULT_DIMENSIONS[preset] };
}

export function safeZoneFor(format: OutputFormat): SafeZone {
  return { ...DEFAULT_SAFE_ZONES[format.preset] };
}
