import type { Ms } from '../types/units';

export const CAPTION_STYLES = [
  'bold-impact',
  'clean-sans',
  'outline-pop',
  'subtle-lower',
  'off',
] as const;

export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export interface CaptionStyleGrouping {
  readonly minWords: number;
  readonly maxWords: number;
  readonly minDurationMs: Ms;
  readonly maxDurationMs: Ms;
  readonly maxGapMs: Ms;
}

const SUBTITLE_GROUPING: CaptionStyleGrouping = {
  minWords: 6,
  maxWords: 10,
  minDurationMs: 2000,
  maxDurationMs: 4000,
  maxGapMs: 900,
};

export function isCaptionStyle(value: unknown): value is CaptionStyle {
  return typeof value === 'string' && (CAPTION_STYLES as readonly string[]).includes(value);
}

export function captionGroupingForStyle(
  style: CaptionStyle | undefined,
): CaptionStyleGrouping | null {
  return style === 'subtle-lower' ? SUBTITLE_GROUPING : null;
}
