import { deriveBrandTokens, tokensToCss } from './derive-brand-tokens';
import type { BrandTypography } from './derive-brand-tokens';
import type { BrandManifest } from './brand-manifest';

const DECLARATION = /(--mg-[a-z0-9-]+)\s*:\s*([^;]+);/gu;

export function parseCssTokens(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(DECLARATION)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()]));
}

function typographyOf(brand: BrandManifest): BrandTypography | undefined {
  if (brand.typography !== undefined) return brand.typography;
  const [first] = brand.fonts;
  return first === undefined ? undefined : { display: first.family, body: first.family };
}

export function effectiveBrandTokens(brand: BrandManifest, cssFileContent?: string): Record<string, string> {
  const base =
    cssFileContent !== undefined
      ? parseCssTokens(cssFileContent)
      : brand.palette !== undefined
        ? deriveBrandTokens(brand.palette, typographyOf(brand))
        : {};
  return { ...base, ...brand.tokens };
}

export function brandCss(brand: BrandManifest, cssFileContent?: string): string {
  const overrides = brand.tokens === undefined ? '' : tokensToCss(brand.tokens);
  if (cssFileContent !== undefined) return overrides === '' ? cssFileContent : `${cssFileContent.trimEnd()}\n${overrides}`;
  if (brand.palette === undefined) return overrides;
  return `${tokensToCss(deriveBrandTokens(brand.palette, typographyOf(brand)))}${overrides}`;
}
