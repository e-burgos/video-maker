import type { Ms } from '../types/units';

export const VOICE_SCRIPT_MIN_LENGTH_SCALE = 0.85;

export interface VoiceScriptPlacementRequest {
  readonly requestedStartMs: Ms | null;
  readonly requestedEndMs: Ms | null;
  readonly durationMs: Ms;
}

export interface VoiceScriptPlacement {
  readonly startMs: Ms;
  readonly endMs: Ms;
  readonly requestedStartMs: Ms | null;
  readonly overflowMs: Ms;
  readonly lengthScale: number;
}

export interface PlanVoiceScriptPlacementsOptions {
  readonly gapMs: Ms;
  readonly allowSpeedUp?: boolean;
}

function windowLimitMs(
  lines: readonly VoiceScriptPlacementRequest[],
  index: number,
): number {
  const ownEndMs = lines[index]?.requestedEndMs ?? Number.POSITIVE_INFINITY;
  const nextStartMs = lines[index + 1]?.requestedStartMs ?? Number.POSITIVE_INFINITY;
  return Math.min(ownEndMs, nextStartMs);
}

function speedUpScaleFor(durationMs: Ms, availableMs: number, gapMs: Ms): number {
  if (!Number.isFinite(availableMs) || availableMs <= 0) {
    return 1;
  }
  if (durationMs + gapMs <= availableMs || durationMs <= availableMs) {
    return 1;
  }
  return Math.max(VOICE_SCRIPT_MIN_LENGTH_SCALE, Math.floor((availableMs / durationMs) * 100) / 100);
}

function overflowFor(durationMs: Ms, availableMs: number): Ms {
  return Number.isFinite(availableMs) ? Math.max(0, Math.round(durationMs - availableMs)) : 0;
}

export function planVoiceScriptPlacements(
  lines: readonly VoiceScriptPlacementRequest[],
  options: PlanVoiceScriptPlacementsOptions,
): readonly VoiceScriptPlacement[] {
  const allowSpeedUp = options.allowSpeedUp ?? true;
  const placements: VoiceScriptPlacement[] = [];
  let previousEndMs: number | null = null;

  lines.forEach((line, index) => {
    const chainedStartMs = previousEndMs === null ? 0 : previousEndMs + options.gapMs;
    const desiredStartMs = line.requestedStartMs ?? chainedStartMs;
    const startMs =
      previousEndMs === null ? desiredStartMs : Math.max(desiredStartMs, previousEndMs);
    const availableMs = windowLimitMs(lines, index) - startMs;
    const endMs = startMs + line.durationMs;

    placements.push({
      startMs,
      endMs,
      requestedStartMs: line.requestedStartMs,
      overflowMs: overflowFor(line.durationMs, availableMs),
      lengthScale: allowSpeedUp ? speedUpScaleFor(line.durationMs, availableMs, options.gapMs) : 1,
    });

    previousEndMs = endMs;
  });

  return placements;
}
