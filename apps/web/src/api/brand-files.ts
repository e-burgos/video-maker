import { servicePathUrl } from './artifact-url';
import type { BrandManifest, BrandPalette } from './brand-types';

const PALETTE_TOKENS: Readonly<Record<keyof BrandPalette, string>> = {
  background: '--mg-bg',
  accent: '--mg-accent',
  accent2: '--mg-accent-2',
  text: '--mg-text',
};

export const PALETTE_KEYS = ['background', 'accent', 'accent2', 'text'] as const satisfies readonly (keyof BrandPalette)[];

function encodePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function brandFileUrl(brandId: string, path: string): string {
  return servicePathUrl(`/brands/${encodeURIComponent(brandId)}/files/${encodePath(path)}`);
}

export function brandPreviewUrl(url: string): string {
  return servicePathUrl(url);
}

export function fileStemSlug(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/u, '');
  const slug = stem
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug === '' ? 'item' : slug;
}

export function uniqueKey(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function effectivePalette(
  manifest: BrandManifest,
  tokens: Readonly<Record<string, string>>,
): BrandPalette {
  const fromTokens = (key: keyof BrandPalette): string =>
    tokens[PALETTE_TOKENS[key]] ?? manifest.palette?.[key] ?? '#000000';
  return {
    background: fromTokens('background'),
    accent: fromTokens('accent'),
    accent2: fromTokens('accent2'),
    text: fromTokens('text'),
  };
}

export function paletteTokenName(key: keyof BrandPalette): string {
  return PALETTE_TOKENS[key];
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/u.test(value);
}

export function brandContentType(filename: string, declared: string): string {
  if (declared !== '') {
    return declared;
  }
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const known: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  };
  return known[extension] ?? 'application/octet-stream';
}

export function cornersToScreen(
  corners: readonly [number, number][],
): { polygon: [number, number][] } | null {
  return corners.length === 4 ? { polygon: corners.map(([x, y]) => [x, y] as [number, number]) } : null;
}

export function percentPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): [number, number] {
  const clamp = (value: number): number => Math.min(100, Math.max(0, value));
  const round = (value: number): number => Math.round(value * 100) / 100;
  return [
    round(clamp(((clientX - rect.left) / rect.width) * 100)),
    round(clamp(((clientY - rect.top) / rect.height) * 100)),
  ];
}

export function safeUploadName(filename: string): string {
  const extension = filename.includes('.') ? (filename.split('.').pop() ?? '').toLowerCase() : '';
  const stem = fileStemSlug(filename);
  return extension === '' ? stem : `${stem}.${extension}`;
}
