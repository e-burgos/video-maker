import { MAX_VOICE_PAUSE_AFTER_MS } from '@video-maker/timeline-core';
import type { VoiceDirection, VoiceEnergy, VoicePace, VoiceScriptDirections } from '@video-maker/timeline-core';

export const MAX_EMPHASIS_WORDS = 8;
export const MIN_EMPHASIS_WORD_LENGTH = 3;
export const PAUSE_STEP_MS = 100;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function compactDirection(direction: VoiceDirection): VoiceDirection | undefined {
  const compact: VoiceDirection = {
    ...(direction.intent === undefined || direction.intent.trim() === '' ? {} : { intent: direction.intent }),
    ...(direction.pace === undefined || direction.pace === 'normal' ? {} : { pace: direction.pace }),
    ...(direction.energy === undefined || direction.energy === 'neutral' ? {} : { energy: direction.energy }),
    ...(direction.pauseAfterMs === undefined || direction.pauseAfterMs === 0
      ? {}
      : { pauseAfterMs: direction.pauseAfterMs }),
    ...(direction.emphasis === undefined || direction.emphasis.length === 0
      ? {}
      : { emphasis: direction.emphasis }),
  };
  return Object.keys(compact).length === 0 ? undefined : compact;
}

export function hasDirection(direction: VoiceDirection | undefined): boolean {
  return direction !== undefined && compactDirection(direction) !== undefined;
}

export function clampPauseMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(MAX_VOICE_PAUSE_AFTER_MS, Math.max(0, Math.round(value)));
}

export function withPace(direction: VoiceDirection | undefined, pace: VoicePace): VoiceDirection | undefined {
  return compactDirection({ ...direction, pace });
}

export function withEnergy(
  direction: VoiceDirection | undefined,
  energy: VoiceEnergy,
): VoiceDirection | undefined {
  return compactDirection({ ...direction, energy });
}

export function withPauseAfterMs(
  direction: VoiceDirection | undefined,
  pauseAfterMs: number,
): VoiceDirection | undefined {
  return compactDirection({ ...direction, pauseAfterMs: clampPauseMs(pauseAfterMs) });
}

export function wordsOfLine(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0];
    const key = word.toLowerCase();
    if (word.length >= MIN_EMPHASIS_WORD_LENGTH && !seen.has(key)) {
      seen.add(key);
      words.push(word);
    }
  }
  return words;
}

export function isEmphasized(direction: VoiceDirection | undefined, word: string): boolean {
  const key = word.toLowerCase();
  return (direction?.emphasis ?? []).some((candidate) => candidate.toLowerCase() === key);
}

export function emphasisIsFull(direction: VoiceDirection | undefined): boolean {
  return (direction?.emphasis ?? []).length >= MAX_EMPHASIS_WORDS;
}

export function toggleEmphasis(
  direction: VoiceDirection | undefined,
  word: string,
): VoiceDirection | undefined {
  const current = direction?.emphasis ?? [];
  if (isEmphasized(direction, word)) {
    const key = word.toLowerCase();
    return compactDirection({
      ...direction,
      emphasis: current.filter((candidate) => candidate.toLowerCase() !== key),
    });
  }
  if (current.length >= MAX_EMPHASIS_WORDS) {
    return direction;
  }
  return compactDirection({ ...direction, emphasis: [...current, word] });
}

export function emphasisInLine(direction: VoiceDirection | undefined, text: string): VoiceDirection | undefined {
  if (direction === undefined) {
    return undefined;
  }
  const lower = text.toLowerCase();
  return compactDirection({
    ...direction,
    emphasis: (direction.emphasis ?? []).filter((word) => lower.includes(word.toLowerCase())),
  });
}

export function setLineDirection(
  directions: VoiceScriptDirections,
  lineIndex: number,
  direction: VoiceDirection | undefined,
): VoiceScriptDirections {
  const key = String(lineIndex);
  const rest = Object.fromEntries(Object.entries(directions).filter(([candidate]) => candidate !== key));
  const compact = direction === undefined ? undefined : compactDirection(direction);
  return compact === undefined ? rest : { ...rest, [key]: compact };
}

export function directionOfLine(
  directions: VoiceScriptDirections,
  lineIndex: number,
): VoiceDirection | undefined {
  return directions[String(lineIndex)];
}

export function sameDirection(a: VoiceDirection | undefined, b: VoiceDirection | undefined): boolean {
  return JSON.stringify(a === undefined ? null : compactDirection(a) ?? null) ===
    JSON.stringify(b === undefined ? null : compactDirection(b) ?? null);
}

export function sameDirections(a: VoiceScriptDirections, b: VoiceScriptDirections): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => sameDirection(a[key], b[key]));
}

export function directedLineCount(directions: VoiceScriptDirections): number {
  return Object.values(directions).filter((direction) => hasDirection(direction)).length;
}
