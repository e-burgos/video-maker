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
  const minFontSize = Math.round(format.height * preset.minFontSizeRatio);
  const maxFontSize = Math.round(format.height * preset.maxFontSizeRatio);

  const wordGaps = Math.max(0, words.length - 1);
  const wordWidthsEm = words.map((word, index) => {
    const baseWidthEm = [...word.text].length * (preset.averageCharWidthEm + preset.letterSpacingEm);
    return index === emphasisIndex ? baseWidthEm * preset.emphasisScale : baseWidthEm;
  });
  const activeReserveEm =
    emphasisIndex === undefined ? 0 : Math.max(0, ...wordWidthsEm) * (preset.activeScale - 1);
  const lines = Math.max(1, preset.maxLines);
  const backdropWidthEm = preset.backdrop === null ? 0 : 2 * preset.backdrop.paddingXEm * lines;
  const backdropHeightEm = preset.backdrop === null ? 0 : 2 * preset.backdrop.paddingYEm;
  const widthEm =
    backdropWidthEm +
    wordWidthsEm.reduce((total, widthEm) => total + widthEm, 0) +
    wordGaps * preset.wordGapEm +
    activeReserveEm;

  if (widthEm <= 0) {
    return maxFontSize;
  }

  const availableWidth = Math.max(0, box.width * (1 - 2 * preset.sidePaddingRatio)) * lines;
  const heightCap = Math.floor(box.height / (preset.lineHeightEm * lines + backdropHeightEm));
  const rawFontSize = Math.min(availableWidth / widthEm, heightCap);

  return Math.min(maxFontSize, Math.max(minFontSize, Math.floor(rawFontSize)));
}
