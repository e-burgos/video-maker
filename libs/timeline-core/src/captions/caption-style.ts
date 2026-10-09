import type { Ms } from '../types/units';

export const CAPTION_STYLES = [
  'bold-impact',
  'clean-sans',
  'outline-pop',
  'subtle-lower',
  'brand',
  'off',
] as const;

export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export interface CaptionStyleGrouping {
  readonly minWords: number;
  readonly maxWords: number;
  readonly minDurationMs: Ms;
  readonly maxDurationMs: Ms;
  readonly maxGapMs: Ms;
  readonly maxChars?: number;
  readonly respectPhrases?: boolean;
}

const SUBTITLE_GROUPING: CaptionStyleGrouping = {
  minWords: 3,
  maxWords: 10,
  minDurationMs: 2000,
  maxDurationMs: 4000,
  maxGapMs: 900,
  maxChars: 52,
  respectPhrases: true,
};

export function isCaptionStyle(value: unknown): value is CaptionStyle {
  return typeof value === 'string' && (CAPTION_STYLES as readonly string[]).includes(value);
}

export function captionGroupingForStyle(
  style: CaptionStyle | undefined,
): CaptionStyleGrouping | null {
  return style === 'subtle-lower' ? SUBTITLE_GROUPING : null;
}
