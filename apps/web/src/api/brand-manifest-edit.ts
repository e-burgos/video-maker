import { effectivePalette } from './brand-files';
import type { BrandDevice, BrandManifest, BrandPalette } from './brand-types';

const KEPT_TOKEN_PREFIX = '--mg-font-';

export function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export function withOptionalText<K extends 'url' | 'taglineAccent' | 'isotipo'>(
  manifest: BrandManifest,
  key: K,
  value: string,
): BrandManifest {
  const trimmed = value.trim();
  if (trimmed === '') {
    return withoutKey(manifest, key) as BrandManifest;
  }
  return { ...manifest, [key]: trimmed };
}

export function withPaletteColor(
  manifest: BrandManifest,
  tokens: Readonly<Record<string, string>>,
  key: keyof BrandPalette,
  value: string,
): BrandManifest {
  const palette = { ...effectivePalette(manifest, tokens), ...manifest.palette, [key]: value };
  const keptTokens = Object.fromEntries(
    Object.entries(manifest.tokens ?? {}).filter(([name]) => name.startsWith(KEPT_TOKEN_PREFIX)),
  );
  const withPalette: BrandManifest = { ...manifest, palette };
  return Object.keys(keptTokens).length === 0
    ? withoutKey(withPalette, 'tokens')
    : { ...withPalette, tokens: keptTokens };
}

export function withTokenOverride(manifest: BrandManifest, name: string, value: string): BrandManifest {
  return { ...manifest, tokens: { ...manifest.tokens, [name]: value } };
}

export function withoutTokenOverride(manifest: BrandManifest, name: string): BrandManifest {
  const remaining = Object.fromEntries(Object.entries(manifest.tokens ?? {}).filter(([key]) => key !== name));
  return Object.keys(remaining).length === 0
    ? withoutKey(manifest, 'tokens')
    : { ...manifest, tokens: remaining };
}

export function fontFamilies(manifest: BrandManifest): string[] {
  return [...new Set(manifest.fonts.map((font) => font.family))];
}

export function withOptionalFlag(device: BrandDevice, key: 'plate' | 'retired', value: boolean): BrandDevice {
  return value ? { ...device, [key]: true } : withoutKey(device, key);
}

export function withOptionalSpokenName(device: BrandDevice, value: string): BrandDevice {
  return value.trim() === '' ? withoutKey(device, 'spokenName') : { ...device, spokenName: value };
}
