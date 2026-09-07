import { z } from 'zod';

export const TranscriptionEngineSchema = z.enum(['whisper.cpp', 'faster-whisper']);

export const WordSchema = z.strictObject({
  text: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});

export const SegmentSchema = z.object({
  startMs: z.number().int(),
  endMs: z.number().int(),
  text: z.string(),
  wordRange: z.tuple([z.number().int(), z.number().int()]),
});

export const TranscriptionSchema = z
  .strictObject({
    assetId: z.string(),
    engine: TranscriptionEngineSchema,
    model: z.string().optional(),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    words: z.array(WordSchema),
    segments: z.array(SegmentSchema),
  })
  .superRefine((transcription, ctx) => {
    const { words, segments } = transcription;

    words.forEach((word, index) => {
      if (word.endMs < word.startMs) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', index, 'endMs'],
          message: `La palabra en el índice ${index} tiene endMs menor que startMs.`,
        });
      }

      const previousWord = words[index - 1];
      if (previousWord === undefined) {
        return;
      }

      if (word.startMs < previousWord.startMs) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', index, 'startMs'],
          message: `Las palabras deben estar ordenadas por startMs no decreciente (índice ${index}).`,
        });
      }

      if (previousWord.endMs > word.startMs) {
        ctx.addIssue({
          code: 'custom',
          path: ['words', index - 1, 'endMs'],
          message: `La palabra en el índice ${index - 1} se solapa con la siguiente.`,
        });
      }
    });

    segments.forEach((segment, index) => {
      const [start, end] = segment.wordRange;
      const isWithinRange = start >= 0 && start <= end && end < words.length;

      if (!isWithinRange) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', index, 'wordRange'],
          message: `El wordRange del segmento en el índice ${index} está fuera de rango.`,
        });
      }
    });
  });

export type TranscriptionEngine = z.infer<typeof TranscriptionEngineSchema>;
export type Word = z.infer<typeof WordSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Transcription = z.infer<typeof TranscriptionSchema>;
