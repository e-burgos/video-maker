import type { Transcription } from '../schemas/transcription.schema';
import type { Ms } from '../types/units';

export interface SilenceRange {
  startMs: Ms;
  endMs: Ms;
}

export interface DetectSilencesOptions {
  minSilenceMs?: Ms;
}

const DEFAULT_MIN_SILENCE_MS = 500;

export function detectSilencesFromWords(
  transcription: Transcription,
  opts: DetectSilencesOptions = {},
): SilenceRange[] {
  const minSilenceMs = opts.minSilenceMs ?? DEFAULT_MIN_SILENCE_MS;
  const { words } = transcription;
  const silences: SilenceRange[] = [];

  for (let index = 0; index < words.length - 1; index += 1) {
    const current = words[index];
    const next = words[index + 1];
    if (current === undefined || next === undefined) {
      continue;
    }

    const gap = next.startMs - current.endMs;
    if (gap >= minSilenceMs) {
      silences.push({ startMs: current.endMs, endMs: next.startMs });
    }
  }

  return silences;
}
