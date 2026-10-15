import type { SecondsRange } from './review-inputs';

export interface MotionSfxCue extends SecondsRange {
  readonly src: string;
  readonly mediaStartSec: number;
  readonly volume: number;
  readonly automation: readonly { readonly t: number; readonly v: number }[];
}

const SFX_AUDIO_TAG = /<audio\b[^>]*\bid="sfx-[^"]*"[^>]*>/gu;

function attributeOf(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(tag)?.[1] ?? null;
}

function numberAttribute(tag: string, name: string, fallback: number): number {
  const value = Number(attributeOf(tag, name));
  return attributeOf(tag, name) === null || !Number.isFinite(value) ? fallback : value;
}

const AUTOMATION_ATTRIBUTE = /\bdata-automation='([^']*)'/u;

function volumeAutomationOf(tag: string): MotionSfxCue['automation'] {
  const raw = AUTOMATION_ATTRIBUTE.exec(tag)?.[1];
  if (raw === undefined) {
    return [];
  }
  try {
    const lanes = (JSON.parse(raw) as { lanes?: { target: string; points: { t: number; v: number }[] }[] }).lanes ?? [];
    return lanes.find((lane) => lane.target === 'volume')?.points ?? [];
  } catch {
    return [];
  }
}

function cueOf(tag: string): MotionSfxCue | null {
  const src = attributeOf(tag, 'src');
  const startSec = numberAttribute(tag, 'data-start', 0);
  const durationSec = numberAttribute(tag, 'data-duration', 0);
  const volume = numberAttribute(tag, 'data-volume', 1);
  return src === null || durationSec <= 0 || volume <= 0
    ? null
    : { src, startSec, endSec: startSec + durationSec, mediaStartSec: numberAttribute(tag, 'data-media-start', 0), volume, automation: volumeAutomationOf(tag) };
}

export function parseMotionSfxCues(html: string): MotionSfxCue[] {
  return [...html.matchAll(SFX_AUDIO_TAG)].flatMap((match) => cueOf(match[0]) ?? []);
}
