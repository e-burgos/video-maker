import { z } from 'zod';

import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { LoudnormJsonSchema } from './loudnorm-output.schema';
import type { LoudnormJson } from './loudnorm-output.schema';

export interface LoudnessMeasurement {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
  thresholdLufs: number;
  targetOffsetDb: number;
}

const COMMAND = 'ffmpeg:loudnorm';
const TRAILING_OBJECT_START_PATTERN = /^\s*\{/gm;

function unparseable(reason: string, raw: string, cause?: unknown): UnparseableOutputError {
  return new UnparseableOutputError({ command: COMMAND, reason, sample: raw, cause });
}

export function extractTrailingJsonObject(text: string): string | undefined {
  let startIndex: number | undefined;
  for (const match of text.matchAll(TRAILING_OBJECT_START_PATTERN)) {
    startIndex = match.index;
  }

  if (startIndex === undefined) {
    return undefined;
  }

  const endIndex = text.lastIndexOf('}');
  if (endIndex < startIndex) {
    return undefined;
  }

  return text.slice(startIndex, endIndex + 1);
}

function toFiniteNumber(text: string, field: string, raw: string): number {
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw unparseable(`El campo ${field} no es un número finito (valor: "${text}").`, raw);
  }
  return value;
}

function parseLoudnormPayload(raw: string): LoudnormJson {
  const json = extractTrailingJsonObject(raw) ?? raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw unparseable('La salida de loudnorm no es JSON válido.', raw, cause);
  }

  const result = LoudnormJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw unparseable(z.prettifyError(result.error), raw, result.error);
  }

  return result.data;
}

export function parseLoudnormJson(text: string): LoudnessMeasurement {
  const payload = parseLoudnormPayload(text);

  return {
    integratedLufs: toFiniteNumber(payload.input_i, 'input_i', text),
    truePeakDbtp: toFiniteNumber(payload.input_tp, 'input_tp', text),
    loudnessRange: toFiniteNumber(payload.input_lra, 'input_lra', text),
    thresholdLufs: toFiniteNumber(payload.input_thresh, 'input_thresh', text),
    targetOffsetDb: toFiniteNumber(payload.target_offset, 'target_offset', text),
  };
}
