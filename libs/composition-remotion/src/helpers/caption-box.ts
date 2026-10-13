import { captionBoxRect } from '@video-maker/timeline-core';
import type { CaptionAnchor, OutputFormat, SafeZone } from '@video-maker/timeline-core';
import type { CaptionPreset } from './caption-preset';
import type { CaptionBox } from './timeline-types';

export type { CaptionAnchor };

export function captionBoxFor(
  safeZone: SafeZone,
  format: OutputFormat,
  preset: CaptionPreset,
  anchor?: CaptionAnchor,
): CaptionBox {
  return captionBoxRect(safeZone, format, preset, anchor);
}
