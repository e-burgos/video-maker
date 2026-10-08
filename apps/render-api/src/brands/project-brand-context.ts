import type { BrandManifest, BrandPalette } from '@video-maker/motion-graphics';
import type { CaptionTheme } from '@video-maker/timeline-core';
import { basename, join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { describeBrand, locateBrand } from './brand-library';
import type { LocatedBrand } from './brand-library';
import { brandPaletteFromTokens } from './brand-palette';

export const PROJECT_BRAND_FONTS_DIRECTORY = 'work/brand/fonts';

export interface ProjectBrandContext {
  readonly id: string;
  readonly name: string;
  readonly spokenName: string;
  readonly tagline: string;
  readonly url: string | null;
  readonly palette: BrandPalette;
  readonly voice: { readonly id: string; readonly lengthScale: number };
  readonly captionTheme: CaptionTheme;
  readonly brandDir: string;
  readonly logoFile: string;
  readonly fontFiles: readonly string[];
}

export function brandLogoAssetStem(brandId: string): string {
  return `brand-${brandId}`;
}

export function brandLogoAssetId(brandId: string, extension = 'png'): string {
  return `raw/logo/${brandLogoAssetStem(brandId)}.${extension}`;
}

export const BRAND_LOGO_ASSET_NAME = /^brand-[a-z][a-z0-9-]*\.(png|webp|jpe?g)$/u;

function captionFamilies(manifest: BrandManifest): readonly string[] {
  const display = manifest.typography?.display ?? manifest.fonts[0]?.family ?? '';
  const body = manifest.typography?.body ?? display;
  return [...new Set([display, body])];
}

function displayFamily(manifest: BrandManifest): string {
  return manifest.typography?.display ?? manifest.fonts[0]?.family ?? '';
}

export function brandCaptionTheme(manifest: BrandManifest, palette: BrandPalette): CaptionTheme {
  const family = displayFamily(manifest);
  return {
    fontFamily: family,
    fontFiles: manifest.fonts
      .filter((font) => font.family === family)
      .map((font) => ({
        path: `${PROJECT_BRAND_FONTS_DIRECTORY}/${basename(font.file)}`,
        ...(font.weight === undefined ? {} : { weight: font.weight }),
        ...(font.unicodeRange === undefined ? {} : { unicodeRange: font.unicodeRange }),
      })),
    textColor: palette.text,
    accentColor: palette.accent,
    boxColor: palette.background,
  };
}

export function projectBrandContext(brand: LocatedBrand, manifest: BrandManifest, tokens: Readonly<Record<string, string>>): ProjectBrandContext {
  const palette = brandPaletteFromTokens(tokens);
  const families = captionFamilies(manifest);
  return {
    id: brand.id,
    name: manifest.name,
    spokenName: manifest.spokenName,
    tagline: manifest.tagline,
    url: manifest.url ?? null,
    palette,
    voice: manifest.voice,
    captionTheme: brandCaptionTheme(manifest, palette),
    brandDir: brand.dir,
    logoFile: join(brand.dir, manifest.logo),
    fontFiles: manifest.fonts.filter((font) => families.includes(font.family)).map((font) => font.file),
  };
}

export async function loadProjectBrandContext(
  deps: RenderApiDependencies,
  store: StoreConfig,
  brandId: string,
): Promise<ProjectBrandContext> {
  const located = await locateBrand(deps, store, brandId);
  const detail = await describeBrand(deps, located);
  return projectBrandContext(located, detail.manifest, detail.tokens);
}
