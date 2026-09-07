import type { SilenceRange } from './detect-silences';

export function mergeSilences(
  a: readonly SilenceRange[],
  b: readonly SilenceRange[],
): SilenceRange[] {
  const sorted = [...a, ...b]
    .filter((range) => range.endMs > range.startMs)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);

  const merged: SilenceRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, range.endMs);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}
