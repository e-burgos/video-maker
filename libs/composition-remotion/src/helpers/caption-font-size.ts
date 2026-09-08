import type { OutputFormat } from '@video-maker/timeline-core';
import type { CaptionPreset } from './caption-preset';
import type { CaptionBox, CaptionWord } from './timeline-types';

export function fitCaptionFontSize(
  words: readonly CaptionWord[],
  box: CaptionBox,
  preset: CaptionPreset,
  format: OutputFormat,
): number {
  const minFontSize = Math.round(format.height * preset.minFontSizeRatio);
  const maxFontSize = Math.round(format.height * preset.maxFontSizeRatio);

  const characterCount = words.reduce((total, word) => total + [...word.text].length, 0);
  const wordGaps = Math.max(0, words.length - 1);
  const widthEm =
    characterCount * (preset.averageCharWidthEm + preset.letterSpacingEm) +
    wordGaps * preset.wordGapEm;

  if (widthEm <= 0) {
    return maxFontSize;
  }

  const availableWidth = Math.max(0, box.width * (1 - 2 * preset.sidePaddingRatio));
  const heightCap = Math.floor(box.height / preset.lineHeightEm);
  const rawFontSize = Math.min(availableWidth / widthEm, heightCap);

  return Math.min(maxFontSize, Math.max(minFontSize, Math.floor(rawFontSize)));
}
