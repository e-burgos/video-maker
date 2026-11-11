import type { Fps, KeepRange, TransitionDecision } from '@video-maker/timeline-core';
import type { RandomGenerator } from '@video-maker/timeline-core';
import { createSeededRandom, hashStringToSeed, msToFrames, pickAvoidingRecent, pickFromPool } from '@video-maker/timeline-core';

import type { MontagePreset } from '../presets/montage-preset';

const DIRECTED_TRANSITION_KINDS = new Set<TransitionDecision['kind']>(['slide', 'whip-pan', 'wipe', 'flip']);
const RECENT_KINDS_TO_AVOID = 2;
const DIRECTION_POOL: readonly ['from-left', 'from-right'] = ['from-left', 'from-right'];

function sequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}

function transitionRandom(seed: number): RandomGenerator {
  return createSeededRandom(hashStringToSeed(`transitions:${seed}`));
}

function directionFor(kind: TransitionDecision['kind'], next: RandomGenerator): TransitionDecision['direction'] {
  return DIRECTED_TRANSITION_KINDS.has(kind) ? pickFromPool(DIRECTION_POOL, next) : undefined;
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
  seed: number,
): readonly TransitionDecision[] {
  const next = transitionRandom(seed);
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
    const kind = pickAvoidingRecent(preset.transitions.kinds, transitions.slice(-RECENT_KINDS_TO_AVOID).map((t) => t.kind), next);
    const direction = directionFor(kind, next);

    transitions.push({
      ...(previousKeep.endMs === keep.startMs ? { handles: true } : {}),
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
