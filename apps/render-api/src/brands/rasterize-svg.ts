export interface RasterSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

export const BRAND_LOGO_RASTER_WIDTH_PX = 1600;
const MAX_RASTER_HEIGHT_PX = 4000;
const SQUARE_FALLBACK: RasterSize = { widthPx: BRAND_LOGO_RASTER_WIDTH_PX, heightPx: BRAND_LOGO_RASTER_WIDTH_PX };

const SVG_ROOT = /<svg\b[^>]*>/iu;

function attributeOf(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'iu').exec(tag);
  return match?.[1] ?? null;
}

function numberOf(value: string | null): number | null {
  if (value === null || value.includes('%')) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function intrinsicDimensions(svg: string): { width: number; height: number } | null {
  const tag = SVG_ROOT.exec(svg)?.[0];
  if (tag === undefined) {
    return null;
  }
  const viewBox = attributeOf(tag, 'viewBox')?.trim().split(/[\s,]+/u).map(Number);
  if (viewBox?.length === 4) {
    const [, , width, height] = viewBox;
    if (width !== undefined && height !== undefined && width > 0 && height > 0) {
      return { width, height };
    }
  }
  const width = numberOf(attributeOf(tag, 'width'));
  const height = numberOf(attributeOf(tag, 'height'));
  return width !== null && height !== null ? { width, height } : null;
}

export function brandLogoRasterSize(svg: string): RasterSize {
  const dimensions = intrinsicDimensions(svg);
  if (dimensions === null) {
    return SQUARE_FALLBACK;
  }
  const heightPx = Math.round((BRAND_LOGO_RASTER_WIDTH_PX * dimensions.height) / dimensions.width);
  return { widthPx: BRAND_LOGO_RASTER_WIDTH_PX, heightPx: Math.min(MAX_RASTER_HEIGHT_PX, Math.max(1, heightPx)) };
}
