import { z } from 'zod';

import { normalizeTranscriptionWords, TranscriptionSchema } from '@video-maker/timeline-core';
import type { AssetId, Segment, Transcription, TranscriptionEngine, Word } from '@video-maker/timeline-core';

import { UnparseableOutputError } from '../errors/unparseable-output-error';

export interface BuildTranscriptionParams {
  assetId: AssetId;
  engine: TranscriptionEngine;
  language: string;
  model?: string;
  words: readonly Word[];
  segments: readonly Segment[];
  raw: string;
}

export function buildTranscription(params: BuildTranscriptionParams): Transcription {
  const { assetId, engine, language, model, words, segments, raw } = params;
  const normalizedWords = normalizeTranscriptionWords(words);

  const doc = {
    assetId,
    engine,
    language,
    words: normalizedWords,
    segments: normalizedWords.length === 0 ? [] : segments,
    ...(model !== undefined ? { model } : {}),
  };

  const result = TranscriptionSchema.safeParse(doc);
  if (!result.success) {
    throw new UnparseableOutputError({
      command: engine,
      reason: z.prettifyError(result.error),
      sample: raw,
      cause: result.error,
    });
  }

  return result.data;
}
