import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';

const Text = z.string().trim().min(1);

export const MotionBriefSchema = z.strictObject({
  version: z.literal(1),
  brand: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  title: Text.optional(),
  format: z.enum(['16:9', '9:16']).default('16:9'),
  beatSync: z.boolean().default(true),
  music: z.union([z.literal('auto'), Text, z.null()]).default('auto'),
  goal: Text.optional(),
  audience: Text.optional(),
  script: Text,
  images: z.array(z.strictObject({ file: Text, caption: Text })).max(12).default([]),
});

export type MotionBrief = z.infer<typeof MotionBriefSchema>;

export function parseMotionBrief(raw: unknown): MotionBrief {
  const result = MotionBriefSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 8).map((issue) => `${formatIssuePath(issue.path) || 'brief'}: ${issue.message}`);
  throw new MotionStudioError('BRIEF_INVALID', `brief.json is invalid:\n  ${lines.join('\n  ')}`);
}

export function briefImageRef(file: string): string {
  return file.startsWith('images/') ? file : `images/${file}`;
}
