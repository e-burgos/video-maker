import type { LogoOverlay, OutputFormat } from '@video-maker/timeline-core';

export interface LogoOverlayBox {
  readonly widthPx: number;
  readonly marginPx: number;
  readonly horizontal: 'left' | 'right';
  readonly vertical: 'top' | 'bottom';
  readonly opacity: number;
}

export function logoOverlayBox(logo: LogoOverlay, format: OutputFormat): LogoOverlayBox {
  const marginPx = Math.round(format.width * logo.marginRatio);
  const maxWidthPx = Math.max(0, format.width - 2 * marginPx);

  return {
    widthPx: Math.min(Math.round(format.width * logo.widthRatio), maxWidthPx),
    marginPx,
    horizontal: logo.position.endsWith('-left') ? 'left' : 'right',
    vertical: logo.position.startsWith('top-') ? 'top' : 'bottom',
    opacity: logo.opacity,
  };
}

export function logoOverlayStyle(logo: LogoOverlay, format: OutputFormat): Record<string, string | number> {
  const box = logoOverlayBox(logo, format);

  return {
    position: 'absolute',
    [box.horizontal]: box.marginPx,
    [box.vertical]: box.marginPx,
    width: box.widthPx,
    opacity: box.opacity,
  };
}
