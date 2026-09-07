import { z } from 'zod';

import type { AssetId, Segment, Transcription, Word } from '@video-maker/timeline-core';

import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { buildTranscription } from './build-transcription';
import { FasterWhisperJsonSchema } from './faster-whisper-output.schema';
import type { ParseTranscriptionOptions } from './parse-whisper-cpp-json';

export type { ParseTranscriptionOptions } from './parse-whisper-cpp-json';

const COMMAND = 'faster-whisper';
const DEFAULT_LANGUAGE = 'es';

function unparseable(reason: string, raw: string, cause?: unknown): UnparseableOutputError {
  return new UnparseableOutputError({ command: COMMAND, reason, sample: raw, cause });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw unparseable('La salida de faster-whisper no es JSON válido.', raw, cause);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toWordMs(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

export function parseFasterWhisperJson(
  raw: string,
  assetId: AssetId,
  opts?: ParseTranscriptionOptions,
): Transcription {
  const obj = parseJson(raw);
  const parsed = FasterWhisperJsonSchema.safeParse(obj);
  if (!parsed.success) {
    throw unparseable(z.prettifyError(parsed.error), raw, parsed.error);
  }

  const { data } = parsed;
  const words: Word[] = [];
  const segments: Segment[] = [];

  for (const segment of data.segments) {
    const first = words.length;

    for (const wordToken of segment.words) {
      const text = wordToken.word.trim();
      if (text === '') {
        continue;
      }

      words.push({
        text,
        startMs: toWordMs(wordToken.start),
        endMs: toWordMs(wordToken.end),
        ...(wordToken.probability !== undefined ? { confidence: clamp01(wordToken.probability) } : {}),
      });
    }

    if (words.length > first) {
      const firstWord = words[first];
      const lastWord = words[words.length - 1];
      if (firstWord === undefined || lastWord === undefined) {
        continue;
      }

      segments.push({
        startMs: segment.start !== undefined ? Math.round(segment.start * 1000) : firstWord.startMs,
        endMs: segment.end !== undefined ? Math.round(segment.end * 1000) : lastWord.endMs,
        text: segment.text?.trim() ?? words.slice(first).map((word) => word.text).join(' '),
        wordRange: [first, words.length - 1],
      });
    }
  }

  const language = opts?.language ?? data.language ?? DEFAULT_LANGUAGE;
  const model = opts?.model ?? data.model;

  return buildTranscription({
    assetId,
    engine: 'faster-whisper',
    language,
    ...(model !== undefined ? { model } : {}),
    words,
    segments,
    raw,
  });
}
