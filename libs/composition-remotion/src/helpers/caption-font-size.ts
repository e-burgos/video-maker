import { fitCaptionFontSizeFor } from '@video-maker/timeline-core';
import type { OutputFormat } from '@video-maker/timeline-core';
import type { CaptionPreset } from './caption-preset';
import type { CaptionBox, CaptionWord } from './timeline-types';

export function fitCaptionFontSize(
  words: readonly CaptionWord[],
  box: CaptionBox,
  preset: CaptionPreset,
  format: OutputFormat,
  emphasisIndex?: number | null,
): number {
  return fitCaptionFontSizeFor(words.map((word) => word.text), box, preset, format, emphasisIndex);
}
