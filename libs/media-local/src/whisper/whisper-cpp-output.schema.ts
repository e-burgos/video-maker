import { z } from 'zod';

export const WhisperCppSegmentSchema = z.object({
  timestamps: z.object({ from: z.string(), to: z.string() }).optional(),
  offsets: z.object({ from: z.number(), to: z.number() }),
  text: z.string(),
});

export const WhisperCppJsonSchema = z
  .object({
    params: z.object({ model: z.string().optional(), language: z.string().optional() }).loose().optional(),
    result: z.object({ language: z.string().optional() }).loose().optional(),
    transcription: z.array(WhisperCppSegmentSchema),
  })
  .loose();

export type WhisperCppSegment = z.infer<typeof WhisperCppSegmentSchema>;
export type WhisperCppJson = z.infer<typeof WhisperCppJsonSchema>;
