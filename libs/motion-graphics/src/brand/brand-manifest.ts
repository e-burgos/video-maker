import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';

const Text = z.string().trim().min(1);
const Point = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

export const BrandManifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  name: Text,
  spokenName: Text.describe('How the voice must write the brand name to pronounce it right'),
  tagline: Text,
  taglineAccent: Text.optional(),
  url: Text.optional(),
  logo: Text,
  isotipo: Text,
  css: Text,
  fonts: z.array(z.strictObject({ family: Text, file: Text, weight: Text.optional() })).min(1),
  devices: z.record(
    z.string(),
    z.strictObject({
      name: Text,
      image: Text,
      kind: z.enum(['counter', 'box', 'screen']),
      screen: z.strictObject({ polygon: z.array(Point).length(4), skew: z.number().optional(), rotate: z.number().optional(), aspect: z.number().positive().optional() }).optional(),
    }),
  ),
  images: z.record(z.string(), Text),
  music: z
    .array(z.strictObject({ id: z.string(), file: Text, credit: Text, bpm: z.number().positive(), mood: Text, drop: z.number().nonnegative().optional() }))
    .min(1),
  voice: z.strictObject({ id: Text, lengthScale: z.number().min(0.7).max(1.4) }),
});

export type BrandManifest = z.infer<typeof BrandManifestSchema>;

export function parseBrandManifest(raw: unknown): BrandManifest {
  const result = BrandManifestSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 6).map((issue) => `${formatIssuePath(issue.path) || 'brand'}: ${issue.message}`);
  throw new MotionStudioError('BRAND_INVALID', `brand.json is invalid:\n  ${lines.join('\n  ')}`);
}
