import type { DuckDecision, Fps, KeepRange, Ms, Word } from '@video-maker/timeline-core';
import { planDucking } from '@video-maker/timeline-core';

import type { MontagePreset } from '../presets/montage-preset';
import { clampToKeep, findEnclosingKeep } from './keep-window';

function sequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}

function clampDuckWindow(
  keeps: readonly KeepRange[],
  startMs: Ms,
  endMs: Ms,
): { readonly startMs: Ms; readonly endMs: Ms } | undefined {
  if (findEnclosingKeep(keeps, startMs, endMs) !== undefined) {
    return { startMs, endMs };
  }

  const containingKeep = findEnclosingKeep(keeps, startMs, startMs);
  if (containingKeep === undefined) {
    return undefined;
  }

  return clampToKeep(containingKeep, startMs, endMs);
}

export function planDuckRanges(
  words: readonly Word[],
  keeps: readonly KeepRange[],
  preset: MontagePreset,
  fps: Fps,
): readonly DuckDecision[] {
  const voiceRanges = words.map((word) => ({ startMs: word.startMs, endMs: word.endMs }));
  const { decisions } = planDucking(voiceRanges, preset.audio, fps);

  const clampedDecisions: DuckDecision[] = [];
  for (const decision of decisions) {
    const window = clampDuckWindow(keeps, decision.startMs, decision.endMs);
    if (window === undefined) {
      continue;
    }
    clampedDecisions.push({
      id: sequentialId('duck', clampedDecisions.length),
      type: 'duck',
      startMs: window.startMs,
      endMs: window.endMs,
      gainDb: decision.gainDb,
    });
  }

  return clampedDecisions;
}
