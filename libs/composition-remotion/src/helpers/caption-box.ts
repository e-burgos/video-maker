import type { OutputFormat, SafeZone } from '@video-maker/timeline-core';
import type { CaptionPreset } from './caption-preset';
import type { CaptionBox } from './timeline-types';

export type CaptionAnchor = 'top' | 'center' | 'bottom';

export function captionBoxFor(
  safeZone: SafeZone,
  format: OutputFormat,
  preset: CaptionPreset,
  anchor?: CaptionAnchor,
): CaptionBox {
  const resolvedAnchor = anchor ?? preset.anchor;
  const availableWidth = Math.max(0, format.width - safeZone.left - safeZone.right);
  const availableHeight = Math.max(0, format.height - safeZone.top - safeZone.bottom);
  const height = Math.min(Math.round(format.height * preset.boxHeightRatio), availableHeight);
  const slack = availableHeight - height;

  const y = resolvedAnchorY(resolvedAnchor, safeZone.top, slack);

  return { x: safeZone.left, y, width: availableWidth, height };
}

function resolvedAnchorY(anchor: CaptionAnchor, safeZoneTop: number, slack: number): number {
  if (anchor === 'top') {
    return safeZoneTop;
  }

  if (anchor === 'center') {
    return safeZoneTop + Math.round(slack / 2);
  }

  return safeZoneTop + slack;
}
