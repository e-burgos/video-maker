import type { CutReason } from '../schemas/edit-decision-list.schema';
import { sequentialId } from '../timeline/ids';
import type { DecisionId, Ms } from '../types/units';
import type { SilenceRange } from './detect-silences';
import { mergeSilences } from './merge-silences';

export interface KeepRange {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
}

export interface CutRange {
  id: DecisionId;
  startMs: Ms;
  endMs: Ms;
  reason: CutReason;
}

export interface PruneSilencesOptions {
  paddingMs?: Ms;
  minKeepMs?: Ms;
}

export interface PruneSilencesResult {
  keeps: KeepRange[];
  cuts: CutRange[];
}

const DEFAULT_PADDING_MS = 80;
const DEFAULT_MIN_KEEP_MS = 300;
const SILENCE_CUT_REASON: CutReason = 'silence';

interface PartitionSegment {
  type: 'keep' | 'cut';
  startMs: Ms;
  endMs: Ms;
}

function clampSilenceToPadding(
  silence: SilenceRange,
  durationMs: Ms,
  paddingMs: Ms,
): SilenceRange | undefined {
  const startMs = Math.max(0, silence.startMs) + paddingMs;
  const endMs = Math.min(durationMs, silence.endMs) - paddingMs;
  return endMs > startMs ? { startMs, endMs } : undefined;
}

function buildRawCuts(
  silences: readonly SilenceRange[],
  durationMs: Ms,
  paddingMs: Ms,
): SilenceRange[] {
  const paddedCuts: SilenceRange[] = [];

  for (const silence of mergeSilences(silences, [])) {
    const padded = clampSilenceToPadding(silence, durationMs, paddingMs);
    if (padded !== undefined) {
      paddedCuts.push(padded);
    }
  }

  return mergeSilences(paddedCuts, []);
}

function partitionByCuts(rawCuts: readonly SilenceRange[], durationMs: Ms): PartitionSegment[] {
  const segments: PartitionSegment[] = [];
  let cursor: Ms = 0;

  for (const cut of rawCuts) {
    if (cut.startMs > cursor) {
      segments.push({ type: 'keep', startMs: cursor, endMs: cut.startMs });
    }
    segments.push({ type: 'cut', startMs: cut.startMs, endMs: cut.endMs });
    cursor = cut.endMs;
  }

  if (cursor < durationMs) {
    segments.push({ type: 'keep', startMs: cursor, endMs: durationMs });
  }

  return segments;
}

function coalesceAdjacentSegments(segments: readonly PartitionSegment[]): PartitionSegment[] {
  const coalesced: PartitionSegment[] = [];

  for (const segment of segments) {
    const last = coalesced[coalesced.length - 1];
    if (last !== undefined && last.type === segment.type && last.endMs === segment.startMs) {
      last.endMs = segment.endMs;
    } else {
      coalesced.push({ ...segment });
    }
  }

  return coalesced;
}

function findAbsorbableKeepIndex(segments: readonly PartitionSegment[], minKeepMs: Ms): number {
  const keepCount = segments.filter((segment) => segment.type === 'keep').length;
  if (keepCount <= 1) {
    return -1;
  }

  return segments.findIndex(
    (segment) => segment.type === 'keep' && segment.endMs - segment.startMs < minKeepMs,
  );
}

function absorbShortKeepsIntoCuts(
  segments: readonly PartitionSegment[],
  minKeepMs: Ms,
): readonly PartitionSegment[] {
  let current = segments;

  for (
    let index = findAbsorbableKeepIndex(current, minKeepMs);
    index !== -1;
    index = findAbsorbableKeepIndex(current, minKeepMs)
  ) {
    const target = current[index];
    if (target === undefined) {
      break;
    }

    const convertedToCut = current.map<PartitionSegment>((segment, segmentIndex) =>
      segmentIndex === index
        ? { type: 'cut', startMs: target.startMs, endMs: target.endMs }
        : segment,
    );

    current = coalesceAdjacentSegments(convertedToCut);
  }

  return current;
}

function toPruneResult(segments: readonly PartitionSegment[]): PruneSilencesResult {
  const keeps: KeepRange[] = [];
  const cuts: CutRange[] = [];

  for (const segment of segments) {
    if (segment.type === 'keep') {
      keeps.push({
        id: sequentialId('keep', keeps.length),
        startMs: segment.startMs,
        endMs: segment.endMs,
      });
    } else {
      cuts.push({
        id: sequentialId('cut', cuts.length),
        startMs: segment.startMs,
        endMs: segment.endMs,
        reason: SILENCE_CUT_REASON,
      });
    }
  }

  return { keeps, cuts };
}

export function pruneSilences(
  durationMs: Ms,
  silences: readonly SilenceRange[],
  opts: PruneSilencesOptions = {},
): PruneSilencesResult {
  if (durationMs <= 0) {
    return { keeps: [], cuts: [] };
  }

  const paddingMs = opts.paddingMs ?? DEFAULT_PADDING_MS;
  const minKeepMs = opts.minKeepMs ?? DEFAULT_MIN_KEEP_MS;

  const rawCuts = buildRawCuts(silences, durationMs, paddingMs);
  const partitioned = partitionByCuts(rawCuts, durationMs);
  const absorbed = absorbShortKeepsIntoCuts(partitioned, minKeepMs);

  return toPruneResult(absorbed);
}
