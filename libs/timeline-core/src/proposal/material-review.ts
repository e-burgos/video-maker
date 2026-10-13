import { z } from 'zod';

export const MATERIAL_REVIEW_VERSION = 1;
export const MATERIAL_REVIEW_SOURCES = ['project', 'brand'] as const;
export const MATERIAL_VERDICTS = ['fits', 'doubtful', 'unfit'] as const;
export const MAX_MATERIAL_REVIEW_ITEMS = 120;
export const MAX_MATERIAL_REVIEW_GAPS = 20;

const BRAND_FILE_PREFIX = 'brand:';

export const MaterialReviewItemSchema = z
  .strictObject({
    file: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((value) => !value.includes('\\') && !value.split('/').includes('..'), 'file must be a project path (images/x.png, raw/...) or brand:<key>'),
    source: z.enum(MATERIAL_REVIEW_SOURCES),
    shows: z.string().trim().min(1).max(300).describe('What the image actually shows, in one line.'),
    useFor: z.string().trim().min(1).max(200).optional(),
    verdict: z.enum(MATERIAL_VERDICTS),
    reason: z.string().trim().min(1).max(400),
  })
  .superRefine((item, ctx) => {
    if (item.file.startsWith(BRAND_FILE_PREFIX) !== (item.source === 'brand')) {
      ctx.addIssue({ code: 'custom', path: ['source'], message: 'brand images are named brand:<key> and have source brand; project images have source project' });
    }
  });

export const MaterialGapSchema = z.strictObject({
  need: z.string().trim().min(1).max(300),
  note: z.string().trim().min(1).max(400),
});

export const MaterialReviewDraftSchema = z
  .strictObject({
    items: z.array(MaterialReviewItemSchema).max(MAX_MATERIAL_REVIEW_ITEMS),
    gaps: z.array(MaterialGapSchema).max(MAX_MATERIAL_REVIEW_GAPS),
  })
  .superRefine((draft, ctx) => {
    const files = draft.items.map((item) => item.file);
    if (new Set(files).size !== files.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'each file is reviewed once' });
    }
  });

export const MaterialReviewSchema = z.strictObject({
  version: z.literal(MATERIAL_REVIEW_VERSION),
  reviewedAt: z.iso.datetime(),
  items: z.array(MaterialReviewItemSchema).max(MAX_MATERIAL_REVIEW_ITEMS),
  gaps: z.array(MaterialGapSchema).max(MAX_MATERIAL_REVIEW_GAPS),
});

export const MaterialWarningsSchema = z.strictObject({
  items: z.array(MaterialReviewItemSchema),
  gaps: z.array(MaterialGapSchema),
});

export type MaterialReviewItem = z.infer<typeof MaterialReviewItemSchema>;
export type MaterialGap = z.infer<typeof MaterialGapSchema>;
export type MaterialReviewDraft = z.infer<typeof MaterialReviewDraftSchema>;
export type MaterialReview = z.infer<typeof MaterialReviewSchema>;
export type MaterialWarnings = z.infer<typeof MaterialWarningsSchema>;
export type MaterialVerdict = (typeof MATERIAL_VERDICTS)[number];

export function materialReviewFrom(draft: MaterialReviewDraft, reviewedAt: string): MaterialReview {
  return { version: MATERIAL_REVIEW_VERSION, reviewedAt, items: draft.items, gaps: draft.gaps };
}

export function materialWarnings(review: MaterialReview): MaterialWarnings {
  return { items: review.items.filter((item) => item.verdict !== 'fits'), gaps: review.gaps };
}

export function hasMaterialWarnings(warnings: MaterialWarnings): boolean {
  return warnings.items.length > 0 || warnings.gaps.length > 0;
}

export function canonicalMaterialPath(file: string): string {
  return file.startsWith('images/') ? `raw/${file}` : file;
}
