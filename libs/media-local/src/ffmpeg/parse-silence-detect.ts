import type { Ms, SilenceRange } from '@video-maker/timeline-core';

export interface ParseSilenceDetectContext {
  durationMs: Ms;
}

const SILENCE_START_PATTERN = /silence_start:\s*(-?\d+(?:\.\d+)?)/;
const SILENCE_END_PATTERN = /silence_end:\s*(-?\d+(?:\.\d+)?)/;

function clampToDurationMs(seconds: number, durationMs: Ms): Ms {
  const rawMs = Math.round(seconds * 1000);
  return Math.min(Math.max(rawMs, 0), durationMs);
}

export function parseSilenceDetect(stderr: string, ctx: ParseSilenceDetectContext): SilenceRange[] {
  const { durationMs } = ctx;
  const ranges: SilenceRange[] = [];
  let openStartMs: Ms | undefined;

  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = SILENCE_START_PATTERN.exec(line);
    if (startMatch !== null) {
      if (openStartMs !== undefined) {
        ranges.push({ startMs: openStartMs, endMs: durationMs });
      }
      openStartMs = clampToDurationMs(Number(startMatch[1]), durationMs);
      continue;
    }

    const endMatch = SILENCE_END_PATTERN.exec(line);
    if (endMatch !== null && openStartMs !== undefined) {
      const endMs = clampToDurationMs(Number(endMatch[1]), durationMs);
      if (endMs > openStartMs) {
        ranges.push({ startMs: openStartMs, endMs });
      }
      openStartMs = undefined;
    }
  }

  if (openStartMs !== undefined && openStartMs < durationMs) {
    ranges.push({ startMs: openStartMs, endMs: durationMs });
  }

  return ranges;
}
