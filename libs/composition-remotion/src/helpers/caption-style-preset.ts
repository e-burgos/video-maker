import type { CaptionStyle } from '@video-maker/timeline-core';

import type { CaptionPresetId } from './caption-preset';

export function captionPresetIdForStyle(
  style: CaptionStyle | undefined,
  fallback: CaptionPresetId | undefined,
): CaptionPresetId | undefined | null {
  if (style === undefined) {
    return fallback;
  }
  return style === 'off' ? null : style;
}
