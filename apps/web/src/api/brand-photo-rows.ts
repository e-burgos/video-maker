import type { BrandImage } from './brand-types';

export type PhotoRow = { key: string; file: string; caption: string };

export function rowsOf(images: Record<string, BrandImage>): PhotoRow[] {
  return Object.entries(images).map(([key, image]) =>
    typeof image === 'string' ? { key, file: image, caption: '' } : { key, file: image.file, caption: image.caption },
  );
}

export function imagesOf(rows: readonly PhotoRow[]): Record<string, BrandImage> {
  return Object.fromEntries(
    rows.map((row) => [row.key, { file: row.file, caption: row.caption.trim() }] as const),
  );
}

