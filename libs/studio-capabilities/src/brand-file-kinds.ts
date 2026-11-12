export const BRAND_FILE_KINDS = ['logo', 'image', 'font', 'music', 'device'] as const;

export type BrandFileKind = (typeof BRAND_FILE_KINDS)[number];
