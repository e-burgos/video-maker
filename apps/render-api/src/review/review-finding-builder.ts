import type { ReviewFinding, ReviewSeverity } from '@video-maker/timeline-core';

import type { SecondsRange } from './review-inputs';

export interface FindingDraft {
  readonly check: string;
  readonly severity: ReviewSeverity;
  readonly message: string;
  readonly timeRange?: SecondsRange;
  readonly proposedFix?: string;
}

export function numbered(drafts: readonly FindingDraft[]): ReviewFinding[] {
  const counters = new Map<string, number>();
  return drafts.map((draft) => {
    const next = (counters.get(draft.check) ?? 0) + 1;
    counters.set(draft.check, next);
    return {
      id: `${draft.check}-${String(next).padStart(2, '0')}`,
      check: draft.check,
      severity: draft.severity,
      message: draft.message,
      ...(draft.timeRange !== undefined ? { timeRange: { startSec: draft.timeRange.startSec, endSec: draft.timeRange.endSec } } : {}),
      ...(draft.proposedFix !== undefined ? { proposedFix: draft.proposedFix } : {}),
    };
  });
}

export function overlapSec(a: SecondsRange, b: SecondsRange): number {
  return Math.max(0, Math.min(a.endSec, b.endSec) - Math.max(a.startSec, b.startSec));
}

export function lengthSec(range: SecondsRange): number {
  return range.endSec - range.startSec;
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}

export function formatDb(value: number): string {
  return value.toFixed(1);
}
