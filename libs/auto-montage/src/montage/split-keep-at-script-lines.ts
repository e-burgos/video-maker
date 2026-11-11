import type { KeepRange } from '@video-maker/timeline-core';

import type { ScriptLineWindow } from '../transcript/align-transcript-to-script-lines';

function keepId(index: number): string {
  return `keep-${String(index + 1).padStart(4, '0')}`;
}

function boundariesBetweenLines(windows: readonly ScriptLineWindow[], keep: KeepRange): number[] {
  const sorted = [...windows].sort((left, right) => left.startMs - right.startMs);
  return sorted
    .slice(1)
    .map((window, index) => Math.round(((sorted[index]?.endMs ?? window.startMs) + window.startMs) / 2))
    .filter((boundary) => boundary > keep.startMs && boundary < keep.endMs);
}

function dropBoundariesTooClose(boundaries: readonly number[], keep: KeepRange, minKeepMs: number): number[] {
  const kept: number[] = [];
  boundaries.forEach((boundary) => {
    const previous = kept[kept.length - 1] ?? keep.startMs;
    if (boundary - previous >= minKeepMs && keep.endMs - boundary >= minKeepMs) kept.push(boundary);
  });
  return kept;
}

export function splitKeepAtScriptLines(
  keeps: readonly KeepRange[],
  lineWindows: readonly ScriptLineWindow[],
  minKeepMs: number,
): readonly KeepRange[] {
  const [only] = keeps;
  if (keeps.length !== 1 || only === undefined || lineWindows.length < 2) {
    return keeps;
  }

  const edges = [only.startMs, ...dropBoundariesTooClose(boundariesBetweenLines(lineWindows, only), only, minKeepMs), only.endMs];
  return edges.slice(1).map((endMs, index) => ({ id: keepId(index), startMs: edges[index] ?? only.startMs, endMs }));
}
