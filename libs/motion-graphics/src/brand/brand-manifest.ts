import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';

const Text = z.string().trim().min(1);
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/u);
const Point = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

const BrandPaletteSchema = z.strictObject({ background: HexColor, accent: HexColor, accent2: HexColor, text: HexColor });
const BrandTypographySchema = z.strictObject({ display: Text, body: Text, mono: Text.optional() });
export const BRAND_TOKEN_NAME = /^--mg-[a-z0-9-]+$/u;

const BrandManifestShape = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  name: Text,
  spokenName: Text.describe('How the voice must write the brand name to pronounce it right'),
  tagline: Text,
  taglineAccent: Text.optional(),
  url: Text.optional(),
  logo: Text,
  isotipo: Text.optional(),
  css: Text.optional(),
  palette: BrandPaletteSchema.optional(),
  tokens: z.record(z.string().regex(BRAND_TOKEN_NAME), Text).optional(),
  typography: BrandTypographySchema.optional(),
  fonts: z.array(z.strictObject({ family: Text, file: Text, weight: Text.optional(), unicodeRange: Text.optional() })).min(1),
  devices: z.record(
    z.string(),
    z.strictObject({
      name: Text,
      image: Text,
      kind: z.enum(['counter', 'box', 'screen']),
      screen: z.strictObject({ polygon: z.array(Point).length(4), skew: z.number().optional(), rotate: z.number().optional(), aspect: z.number().positive().optional() }).optional(),
      retired: z.boolean().optional(),
      plate: z.boolean().optional(),
      spokenName: Text.optional(),
    }),
  ),
  images: z.record(z.string(), z.union([Text, z.strictObject({ file: Text, caption: Text })])),
  music: z.array(z.strictObject({ id: z.string(), file: Text, credit: Text, bpm: z.number().positive(), mood: Text, drop: z.number().nonnegative().optional() })),
  voice: z.strictObject({ id: Text, lengthScale: z.number().min(0.7).max(1.4) }),
});

export const BrandManifestSchema = BrandManifestShape.superRefine((brand, ctx) => {
  if (brand.css === undefined && brand.palette === undefined) {
    ctx.addIssue({ code: 'custom', path: ['palette'], message: 'a brand needs "css" or "palette"' });
  }
  const families = new Set(brand.fonts.map((font) => font.family));
  for (const [role, family] of Object.entries(brand.typography ?? {}) as Array<[string, string | undefined]>) {
    if (family !== undefined && !families.has(family)) ctx.addIssue({ code: 'custom', path: ['typography', role], message: `font family "${family}" is not in "fonts"` });
  }
});

export type BrandManifest = z.infer<typeof BrandManifestSchema>;
export const brandIsotipo = (brand: BrandManifest): string => brand.isotipo ?? brand.logo;
export const brandCssFile = (brand: BrandManifest): string => brand.css ?? 'brand.css';

export function parseBrandManifest(raw: unknown): BrandManifest {
  const result = BrandManifestSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 6).map((issue) => `${formatIssuePath(issue.path) || 'brand'}: ${issue.message}`);
  throw new MotionStudioError('BRAND_INVALID', `brand.json is invalid:\n  ${lines.join('\n  ')}`);
}

export function brandImageFile(brand: BrandManifest, key: string): string | undefined {
  const image = brand.images[key];
  return typeof image === 'string' ? image : image?.file;
}

export function brandImageCaption(brand: BrandManifest, key: string): string | undefined {
  const image = brand.images[key];
  return typeof image === 'string' ? undefined : image?.caption;
}

export function activeDeviceIds(brand: BrandManifest): string[] {
  return Object.entries(brand.devices)
    .filter(([, device]) => device.retired !== true)
    .map(([id]) => id);
}
