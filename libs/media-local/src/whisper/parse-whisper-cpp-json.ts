import { basename } from 'node:path';

import { z } from 'zod';

import type { AssetId, Segment, Transcription, Word } from '@video-maker/timeline-core';

import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { buildTranscription } from './build-transcription';
import { WhisperCppJsonSchema } from './whisper-cpp-output.schema';
import type { WhisperCppSegment } from './whisper-cpp-output.schema';

export interface ParseTranscriptionOptions {
  language?: string;
  model?: string;
}

const COMMAND = 'whisper.cpp';
const DEFAULT_LANGUAGE = 'es';
const SPECIAL_TOKEN_PATTERN = /^\s*\[_[A-Z]+_[^\]]*\]\s*$/;
const LEADING_SPACE_PATTERN = /^\s/;

function unparseable(reason: string, raw: string, cause?: unknown): UnparseableOutputError {
  return new UnparseableOutputError({ command: COMMAND, reason, sample: raw, cause });
}

function isSpecialToken(text: string): boolean {
  return SPECIAL_TOKEN_PATTERN.test(text);
}

export function groupTokensIntoWords(tokens: readonly WhisperCppSegment[]): Word[] {
  const words: Word[] = [];

  for (const token of tokens) {
    const { text } = token;
    if (isSpecialToken(text) || text.trim() === '') {
      continue;
    }

    const startsWord = LEADING_SPACE_PATTERN.test(text) || words.length === 0;
    if (startsWord) {
      words.push({ text: text.trim(), startMs: token.offsets.from, endMs: token.offsets.to });
      continue;
    }

    const lastWord = words[words.length - 1];
    if (lastWord !== undefined) {
      lastWord.text += text.trim();
      lastWord.endMs = token.offsets.to;
    }
  }

  return repairZeroDurationWords(words.filter((word) => word.text !== ''));
}

const FALLBACK_WORD_DURATION_MS = 200;

function hasNoDuration(word: Word): boolean {
  return word.endMs <= word.startMs;
}

function sameStartBlockLength(words: readonly Word[], startIndex: number): number {
  const blockStartMs = (words[startIndex] as Word).startMs;
  let length = 0;
  while (startIndex + length < words.length && (words[startIndex + length] as Word).startMs <= blockStartMs) {
    length += 1;
  }
  return length;
}

function spreadBlockUntil(words: Word[], startIndex: number, blockLength: number, spanEndMs: number): void {
  const blockStartMs = (words[startIndex] as Word).startMs;
  const stepMs = (spanEndMs - blockStartMs) / blockLength;
  for (let offset = 0; offset < blockLength; offset += 1) {
    const word = words[startIndex + offset] as Word;
    word.startMs = Math.round(blockStartMs + offset * stepMs);
    word.endMs = offset === blockLength - 1 ? spanEndMs : Math.round(blockStartMs + (offset + 1) * stepMs);
  }
}

export function repairZeroDurationWords(words: readonly Word[]): Word[] {
  const repaired = words.map((word) => ({ ...word }));
  let index = 0;
  while (index < repaired.length) {
    if (!hasNoDuration(repaired[index] as Word)) {
      index += 1;
      continue;
    }
    const blockLength = sameStartBlockLength(repaired, index);
    const blockStartMs = (repaired[index] as Word).startMs;
    const nextWord = repaired[index + blockLength];
    const spanEndMs =
      nextWord !== undefined ? nextWord.startMs : blockStartMs + FALLBACK_WORD_DURATION_MS * blockLength;
    spreadBlockUntil(repaired, index, blockLength, spanEndMs);
    index += blockLength;
  }
  return repaired;
}

function buildSingleSegment(words: readonly Word[]): Segment[] {
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  if (firstWord === undefined || lastWord === undefined) {
    return [];
  }

  return [
    {
      startMs: firstWord.startMs,
      endMs: lastWord.endMs,
      text: words.map((word) => word.text).join(' '),
      wordRange: [0, words.length - 1],
    },
  ];
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw unparseable('La salida de whisper.cpp no es JSON válido.', raw, cause);
  }
}

export function parseWhisperCppJson(
  raw: string,
  assetId: AssetId,
  opts?: ParseTranscriptionOptions,
): Transcription {
  const obj = parseJson(raw);
  const parsed = WhisperCppJsonSchema.safeParse(obj);
  if (!parsed.success) {
    throw unparseable(z.prettifyError(parsed.error), raw, parsed.error);
  }

  const { data } = parsed;
  const words = groupTokensIntoWords(data.transcription);
  const language = opts?.language ?? data.result?.language ?? data.params?.language ?? DEFAULT_LANGUAGE;
  const modelPath = data.params?.model;
  const model = opts?.model ?? (modelPath !== undefined ? basename(modelPath) : undefined);

  return buildTranscription({
    assetId,
    engine: 'whisper.cpp',
    language,
    ...(model !== undefined ? { model } : {}),
    words,
    segments: buildSingleSegment(words),
    raw,
  });
}
