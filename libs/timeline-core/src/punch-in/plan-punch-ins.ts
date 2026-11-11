import { createSeededRandom, pickFromPool } from '../random/seeded-random';
import { sequentialId } from '../timeline/ids';
import type { KeepRange } from '../silence/prune-silences';
import type { DecisionId, Ms, Scale } from '../types/units';

export type PunchInAnchor = 'center' | 'top' | 'face-hint';

export interface PunchInOptions {
  seed: number;
  every?: number;
  scales?: readonly Scale[];
  anchor?: PunchInAnchor;
}

export interface PunchInPlan {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
  scale: Scale;
  anchor: PunchInAnchor;
  keepId: DecisionId;
}

const DEFAULT_EVERY = 2;
const DEFAULT_SCALES: readonly Scale[] = [1.1, 1.15];
const DEFAULT_ANCHOR: PunchInAnchor = 'center';

function isNonEmptyScaleList(scales: readonly Scale[]): scales is readonly [Scale, ...Scale[]] {
  return scales.length > 0;
}

function isSelectedKeep(zeroBasedIndex: number, every: number): boolean {
  return (zeroBasedIndex + 1) % every === 0;
}

export function planPunchIns(
  keeps: readonly KeepRange[],
  opts: PunchInOptions,
): PunchInPlan[] {
  const every = opts.every ?? DEFAULT_EVERY;
  const scales = opts.scales ?? DEFAULT_SCALES;
  const anchor = opts.anchor ?? DEFAULT_ANCHOR;

  if (every < 1 || !isNonEmptyScaleList(scales)) {
    return [];
  }

  const next = createSeededRandom(opts.seed);
  const plans: PunchInPlan[] = [];

  keeps.forEach((keep, index) => {
    if (!isSelectedKeep(index, every)) {
      return;
    }

    plans.push({
      id: sequentialId('punch', plans.length),
      startMs: keep.startMs,
      endMs: keep.endMs,
      scale: pickFromPool(scales, next),
      anchor,
      keepId: keep.id,
    });
  });

  return plans;
}
