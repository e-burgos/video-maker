import type { OutputFormat } from '../schemas/output-format.schema';

export const LANDSCAPE_LOGO_WIDTH_RATIO = 0.18;
export const PORTRAIT_LOGO_WIDTH_RATIO = 0.28;

export function defaultLogoWidthRatio(format: OutputFormat): number {
  return format.width >= format.height ? LANDSCAPE_LOGO_WIDTH_RATIO : PORTRAIT_LOGO_WIDTH_RATIO;
}
