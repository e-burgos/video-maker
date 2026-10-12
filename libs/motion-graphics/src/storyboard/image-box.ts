import { z } from 'zod';

const OVERFLOW_TOLERANCE = 1e-6;

export const ImageBoxSchema = z
  .strictObject({
    name: z.string().trim().min(1).describe('Name of the region as the dev gave it, e.g. "Tarjeta Plan Propio"'),
    x: z.number().min(0).max(1).describe('Left edge as a fraction of the image width'),
    y: z.number().min(0).max(1).describe('Top edge as a fraction of the image height'),
    w: z.number().gt(0).max(1).describe('Width as a fraction of the image width'),
    h: z.number().gt(0).max(1).describe('Height as a fraction of the image height'),
  })
  .superRefine((box, ctx) => {
    if (box.x + box.w > 1 + OVERFLOW_TOLERANCE) ctx.addIssue({ code: 'custom', path: ['w'], message: `box "${box.name}" leaves the image: x + w = ${box.x + box.w} must be at most 1` });
    if (box.y + box.h > 1 + OVERFLOW_TOLERANCE) ctx.addIssue({ code: 'custom', path: ['h'], message: `box "${box.name}" leaves the image: y + h = ${box.y + box.h} must be at most 1` });
  });

export const ImageBoxListSchema = z.array(ImageBoxSchema).max(40).superRefine((boxes, ctx) => {
  const seen = new Set<string>();
  boxes.forEach((box, index) => {
    if (seen.has(box.name)) ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `duplicated box name "${box.name}"` });
    seen.add(box.name);
  });
});

export type ImageBox = z.infer<typeof ImageBoxSchema>;

export function boxCenter(box: ImageBox): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}
