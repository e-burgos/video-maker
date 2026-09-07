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

type RandomGenerator = () => number;

const DEFAULT_EVERY = 2;
const DEFAULT_SCALES: readonly Scale[] = [1.1, 1.15];
const DEFAULT_ANCHOR: PunchInAnchor = 'center';
const MULBERRY32_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

function createMulberry32(seed: number): RandomGenerator {
  let state = seed >>> 0;

  return () => {
    state = (state + MULBERRY32_INCREMENT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

function isNonEmptyScaleList(scales: readonly Scale[]): scales is readonly [Scale, ...Scale[]] {
  return scales.length > 0;
}

function pickScale(scales: readonly [Scale, ...Scale[]], next: RandomGenerator): Scale {
  const index = Math.min(Math.floor(next() * scales.length), scales.length - 1);
  return scales[index] ?? scales[0];
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

  const next = createMulberry32(opts.seed);
  const plans: PunchInPlan[] = [];

  keeps.forEach((keep, index) => {
    if (!isSelectedKeep(index, every)) {
      return;
    }

    plans.push({
      id: sequentialId('punch', plans.length),
      startMs: keep.startMs,
      endMs: keep.endMs,
      scale: pickScale(scales, next),
      anchor,
      keepId: keep.id,
    });
  });

  return plans;
}
