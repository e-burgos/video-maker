import type { BrandPalette } from '@video-maker/motion-graphics';

export const DEFAULT_BRAND_PALETTE: BrandPalette = { background: '#09090b', accent: '#0ea5e9', accent2: '#14b8a6', text: '#fafafa' };

const HEX = /#[0-9a-fA-F]{6}/gu;

function hexColors(value: string | undefined): string[] {
  return value?.match(HEX) ?? [];
}

export function brandPaletteFromTokens(tokens: Readonly<Record<string, string>>): BrandPalette {
  const gradientColors = hexColors(tokens['--mg-accent-grad-text']);
  return {
    background: hexColors(tokens['--mg-bg'])[0] ?? DEFAULT_BRAND_PALETTE.background,
    accent: hexColors(tokens['--mg-accent'])[0] ?? DEFAULT_BRAND_PALETTE.accent,
    accent2: gradientColors[gradientColors.length - 1] ?? DEFAULT_BRAND_PALETTE.accent2,
    text: hexColors(tokens['--mg-text'])[0] ?? DEFAULT_BRAND_PALETTE.text,
  };
}
