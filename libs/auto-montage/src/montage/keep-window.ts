import type { KeepRange, Ms } from '@video-maker/timeline-core';

export function findEnclosingKeep(
  keeps: readonly KeepRange[],
  startMs: Ms,
  endMs: Ms,
): KeepRange | undefined {
  return keeps.find((keep) => startMs >= keep.startMs && endMs <= keep.endMs);
}

export function clampToKeep(
  keep: KeepRange,
  startMs: Ms,
  endMs: Ms,
): { readonly startMs: Ms; readonly endMs: Ms } | undefined {
  if (startMs < keep.startMs || startMs >= keep.endMs) {
    return undefined;
  }
  return { startMs, endMs: Math.min(endMs, keep.endMs) };
}
