import type { OutputFormat, SafeZone } from '@video-maker/timeline-core';
import type { CaptionBox } from './timeline-types';

export function captionLayout(safeZone: SafeZone, format: OutputFormat): CaptionBox {
  return {
    x: safeZone.left,
    y: safeZone.top,
    width: Math.max(0, format.width - safeZone.left - safeZone.right),
    height: Math.max(0, format.height - safeZone.top - safeZone.bottom),
  };
}
