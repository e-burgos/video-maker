import type { KeepRange } from '../silence/prune-silences';
import type { Ms } from '../types/units';

export function remapMsAfterCuts(ms: Ms, keeps: readonly KeepRange[]): Ms {
  const sortedKeeps = [...keeps].sort((left, right) => left.startMs - right.startMs);
  let accumulatedMs: Ms = 0;

  for (const keep of sortedKeeps) {
    if (ms < keep.startMs) {
      return accumulatedMs;
    }
    if (ms < keep.endMs) {
      return accumulatedMs + (ms - keep.startMs);
    }
    accumulatedMs += keep.endMs - keep.startMs;
  }

  return accumulatedMs;
}
