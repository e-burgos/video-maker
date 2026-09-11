import type { CaptionStyle } from '@video-maker/timeline-core';

import type { MontagePresetName } from './montage-preset';

export const CAPTION_STYLE_BY_MONTAGE_PRESET: Record<MontagePresetName, CaptionStyle> = {
  'software-demo': 'bold-impact',
  hardware: 'bold-impact',
  recipe: 'bold-impact',
  educational: 'subtle-lower',
};

export function captionStyleForMontagePreset(
  presetName: MontagePresetName,
  requested: CaptionStyle | undefined,
): CaptionStyle {
  return requested ?? CAPTION_STYLE_BY_MONTAGE_PRESET[presetName];
}
