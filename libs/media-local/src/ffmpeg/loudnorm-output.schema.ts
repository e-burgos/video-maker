import { z } from 'zod';

export const LoudnormJsonSchema = z
  .object({
    input_i: z.string(),
    input_tp: z.string(),
    input_lra: z.string(),
    input_thresh: z.string(),
    target_offset: z.string(),
  })
  .loose();

export type LoudnormJson = z.infer<typeof LoudnormJsonSchema>;
