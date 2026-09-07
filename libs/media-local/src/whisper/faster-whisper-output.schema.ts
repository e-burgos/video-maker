import { z } from 'zod';

export const FasterWhisperWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  probability: z.number().optional(),
});

export const FasterWhisperSegmentSchema = z.object({
  start: z.number().optional(),
  end: z.number().optional(),
  text: z.string().optional(),
  words: z.array(FasterWhisperWordSchema).default([]),
});

export const FasterWhisperJsonSchema = z
  .object({
    language: z.string().optional(),
    model: z.string().optional(),
    segments: z.array(FasterWhisperSegmentSchema),
  })
  .loose();

export type FasterWhisperWord = z.infer<typeof FasterWhisperWordSchema>;
export type FasterWhisperSegment = z.infer<typeof FasterWhisperSegmentSchema>;
export type FasterWhisperJson = z.infer<typeof FasterWhisperJsonSchema>;
