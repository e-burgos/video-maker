import type { SecondsRange } from './review-inputs';

export interface MotionSfxCue extends SecondsRange {
  readonly src: string;
  readonly mediaStartSec: number;
  readonly volume: number;
}

const SFX_AUDIO_TAG = /<audio\b[^>]*\bid="sfx-[^"]*"[^>]*>/gu;

function attributeOf(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(tag)?.[1] ?? null;
}

function numberAttribute(tag: string, name: string, fallback: number): number {
  const value = Number(attributeOf(tag, name));
  return attributeOf(tag, name) === null || !Number.isFinite(value) ? fallback : value;
}

function cueOf(tag: string): MotionSfxCue | null {
  const src = attributeOf(tag, 'src');
  const startSec = numberAttribute(tag, 'data-start', 0);
  const durationSec = numberAttribute(tag, 'data-duration', 0);
  const volume = numberAttribute(tag, 'data-volume', 1);
  return src === null || durationSec <= 0 || volume <= 0
    ? null
    : { src, startSec, endSec: startSec + durationSec, mediaStartSec: numberAttribute(tag, 'data-media-start', 0), volume };
}

export function parseMotionSfxCues(html: string): MotionSfxCue[] {
  return [...html.matchAll(SFX_AUDIO_TAG)].flatMap((match) => cueOf(match[0]) ?? []);
}
