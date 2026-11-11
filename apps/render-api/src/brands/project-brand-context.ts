import type { BrandManifest, BrandPalette } from '@video-maker/motion-graphics';
import type { MontageBrand } from '@video-maker/auto-montage';
import { MAX_LOGO_BUMPER_CAPTION_LENGTH } from '@video-maker/timeline-core';
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
  readonly writtenNames: readonly BrandWrittenName[];
  readonly bumperStyle?: BrandBumperStyle;
}

export type BrandBumperStyle = NonNullable<MontageBrand['bumperStyle']>;

const SIX_DIGIT_HEX = /^#[0-9a-fA-F]{6}$/u;

function hexField<K extends string>(key: K, color: string): Partial<Record<K, string>> {
  return (SIX_DIGIT_HEX.test(color) ? { [key]: color } : {}) as Partial<Record<K, string>>;
}

export function brandBumperStyle(manifest: BrandManifest, palette: BrandPalette): BrandBumperStyle {
  const outroCaption = manifest.bumpers?.outroCaption ?? manifest.url;
  return {
    ...hexField('accentColor', palette.accent),
    ...hexField('secondaryColor', palette.accent2),
    ...(outroCaption === undefined || outroCaption.length > MAX_LOGO_BUMPER_CAPTION_LENGTH ? {} : { outroCaption }),
    ...(manifest.bumpers?.backgrounds === undefined ? {} : { backgrounds: manifest.bumpers.backgrounds }),
    ...(manifest.bumpers?.reveals === undefined ? {} : { reveals: manifest.bumpers.reveals }),
  };
}

export interface BrandWrittenName {
  readonly spoken: string;
  readonly written: string;
}

export function brandWrittenNames(manifest: BrandManifest): readonly BrandWrittenName[] {
  const pairs = [
    { spoken: manifest.spokenName, written: manifest.name },
    ...Object.values(manifest.devices).map((device) => ({ spoken: device.spokenName ?? device.name, written: device.name })),
  ];
  return pairs.filter((pair) => pair.spoken.trim() !== '' && pair.spoken !== pair.written);
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
    writtenNames: brandWrittenNames(manifest),
    bumperStyle: brandBumperStyle(manifest, palette),
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
