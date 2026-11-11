import type { CSSProperties } from 'react';
import type { OutputFormat, SafeZone, TextOverlayKind, TextOverlayPlacement } from '@video-maker/timeline-core';

export interface TextOverlayLayout {
  readonly box: CSSProperties;
  readonly align: 'left' | 'right' | 'center';
  readonly slideFrom: 'left' | 'right' | 'up' | 'down';
  readonly unit: number;
}

const MARGIN_RATIO = 0.02;
const CAPTION_RESERVE_RATIO = { landscape: 0.2, portrait: 0.14 } as const;
const MAX_WIDTH_RATIO: Readonly<Record<TextOverlayKind, number>> = {
  'lower-third': 0.36,
  'chapter-title': 0.42,
  'kinetic-text': 0.6,
};

function horizontalAlign(placement: TextOverlayPlacement): TextOverlayLayout['align'] {
  if (placement.endsWith('-left')) {
    return 'left';
  }
  return placement.endsWith('-right') ? 'right' : 'center';
}

function slideFromFor(placement: TextOverlayPlacement, align: TextOverlayLayout['align']): TextOverlayLayout['slideFrom'] {
  if (align === 'center') {
    return placement.startsWith('top') ? 'up' : 'down';
  }
  return align;
}

export function textOverlayLayout(input: {
  readonly kind: TextOverlayKind;
  readonly placement: TextOverlayPlacement;
  readonly format: OutputFormat;
  readonly safeZone: SafeZone;
  readonly reserveCaptionBand: boolean;
}): TextOverlayLayout {
  const { kind, placement, format, safeZone, reserveCaptionBand } = input;
  const shortSide = Math.min(format.width, format.height);
  const margin = Math.round(shortSide * MARGIN_RATIO);
  const portrait = format.height > format.width;
  const captionReserve = reserveCaptionBand
    ? Math.round(format.height * (portrait ? CAPTION_RESERVE_RATIO.portrait : CAPTION_RESERVE_RATIO.landscape))
    : 0;
  const align = horizontalAlign(placement);
  const vertical: CSSProperties = placement.startsWith('top')
    ? { top: safeZone.top + margin }
    : { bottom: safeZone.bottom + margin + captionReserve };
  const maxWidth = Math.round(format.width * MAX_WIDTH_RATIO[kind]);
  const horizontal: CSSProperties =
    align === 'left'
      ? { left: safeZone.left + margin }
      : align === 'right'
        ? { right: safeZone.right + margin }
        : { left: Math.round((format.width - maxWidth) / 2) };

  return {
    box: {
      position: 'absolute',
      ...vertical,
      ...horizontal,
      maxWidth,
      ...(align === 'center' ? { width: maxWidth } : {}),
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    },
    align,
    slideFrom: slideFromFor(placement, align),
    unit: shortSide,
  };
}

export function withAlpha(hexColor: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${channel}`;
}
