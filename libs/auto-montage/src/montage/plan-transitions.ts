import type { Fps, KeepRange, TransitionDecision } from '@video-maker/timeline-core';
import { msToFrames } from '@video-maker/timeline-core';

import type { MontagePreset } from '../presets/montage-preset';

const DIRECTED_TRANSITION_KINDS = new Set<TransitionDecision['kind']>(['slide', 'whip-pan']);
const DIRECTION_CYCLE: readonly ['from-left', 'from-right'] = ['from-left', 'from-right'];

function sequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}

function cyclicPick<T>(nonEmpty: readonly [T, ...T[]], index: number): T {
  const [first] = nonEmpty;
  const position = index % nonEmpty.length;
  return nonEmpty.reduce((selected, candidate, i) => (i === position ? candidate : selected), first);
}

function keepDurationMs(keep: KeepRange): number {
  return keep.endMs - keep.startMs;
}

function isTransitionAllowed(
  durationMs: number,
  previousKeep: KeepRange,
  currentKeep: KeepRange,
  fps: Fps,
): boolean {
  const shorterKeepDurationMs = Math.min(keepDurationMs(previousKeep), keepDurationMs(currentKeep));
  if (durationMs >= shorterKeepDurationMs) {
    return false;
  }
  return msToFrames(durationMs, fps) >= 1;
}

export function planTransitions(
  keeps: readonly KeepRange[],
  preset: MontagePreset,
  fps: Fps,
): readonly TransitionDecision[] {
  const sortedKeeps = [...keeps].sort((left, right) => left.startMs - right.startMs);
  const transitions: TransitionDecision[] = [];

  sortedKeeps.forEach((keep, i) => {
    if (i === 0 || i % preset.transitions.every !== 0) {
      return;
    }

    const previousKeep = sortedKeeps[i - 1];
    if (
      previousKeep === undefined ||
      !isTransitionAllowed(preset.transitions.durationMs, previousKeep, keep, fps)
    ) {
      return;
    }

    const n = transitions.length;
    const kind = cyclicPick(preset.transitions.kinds, n);
    const direction = DIRECTED_TRANSITION_KINDS.has(kind) ? cyclicPick(DIRECTION_CYCLE, n) : undefined;

    transitions.push({
      id: sequentialId('trans', n),
      type: 'transition',
      atMs: keep.startMs,
      durationMs: preset.transitions.durationMs,
      kind,
      ...(direction !== undefined ? { direction } : {}),
      timing: preset.transitions.timing,
    });
  });

  return transitions;
}
