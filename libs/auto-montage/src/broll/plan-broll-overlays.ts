import type { Fps, KeepRange, Ms, PunchInPlan } from '@video-maker/timeline-core';
import { framesToMs } from '@video-maker/timeline-core';

import type { Concept, ConceptSource } from '../concepts/concept';
import { clampToKeep, findEnclosingKeep } from '../montage/keep-window';
import type { ClipFit, MontagePreset } from '../presets/montage-preset';
import type { BrollCandidate } from './build-broll-index';
import { selectBrollAsset } from './select-broll-asset';

export type BrollRejectionReason =
  | 'no-candidate'
  | 'outside-keep'
  | 'punch-in-overlap'
  | 'repeat-window'
  | 'overlay-gap'
  | 'coverage-cap'
  | 'too-short';

export interface BrollRejection {
  readonly conceptTerm: string;
  readonly startMs: Ms;
  readonly assetId: string | null;
  readonly reason: BrollRejectionReason;
}

export interface BrollOverlayPlan {
  readonly id: string;
  readonly startMs: Ms;
  readonly endMs: Ms;
  readonly assetId: string;
  readonly fit: ClipFit;
  readonly keepVoice: true;
}

export interface PlanBrollOverlaysInput {
  readonly concepts: readonly Concept[];
  readonly index: readonly BrollCandidate[];
  readonly keeps: readonly KeepRange[];
  readonly punchIns: readonly PunchInPlan[];
  readonly preset: MontagePreset;
  readonly fps: Fps;
}

export interface PlanBrollOverlaysResult {
  readonly overlays: readonly BrollOverlayPlan[];
  readonly rejections: readonly BrollRejection[];
}

interface OccurrenceCandidate {
  readonly conceptTerm: string;
  readonly source: ConceptSource;
  readonly startMs: Ms;
  readonly endMs: Ms;
}

interface OverlayWindow {
  readonly startMs: Ms;
  readonly endMs: Ms;
}

const SOURCE_SWEEP_PRIORITY: Readonly<Record<ConceptSource, number>> = {
  dictionary: 0,
  frequency: 1,
};

function sequentialId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function flattenOccurrences(concepts: readonly Concept[]): readonly OccurrenceCandidate[] {
  return concepts.flatMap((concept) =>
    concept.occurrences.map(
      (occurrence): OccurrenceCandidate => ({
        conceptTerm: concept.term,
        source: concept.source,
        startMs: occurrence.startMs,
        endMs: occurrence.endMs,
      }),
    ),
  );
}

function compareAscending(left: string, right: string): number {
  return left < right ? -1 : 1;
}

function compareOccurrences(left: OccurrenceCandidate, right: OccurrenceCandidate): number {
  if (left.startMs !== right.startMs) {
    return left.startMs - right.startMs;
  }

  const leftPriority = SOURCE_SWEEP_PRIORITY[left.source];
  const rightPriority = SOURCE_SWEEP_PRIORITY[right.source];
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return compareAscending(left.conceptTerm, right.conceptTerm);
}

function targetDurationMs(candidate: BrollCandidate, preset: MontagePreset, fps: Fps): number {
  const frameMs = framesToMs(1, fps, 'ceil');
  const assetCapMs = candidate.kind === 'image' ? Infinity : candidate.durationMs - frameMs;
  const desiredMs = clamp(
    preset.broll.targetDurationMs,
    preset.broll.minDurationMs,
    preset.broll.maxDurationMs,
  );
  return Math.min(desiredMs, assetCapMs);
}

function resolveOverlayWindow(
  keeps: readonly KeepRange[],
  startMs: Ms,
  proposedEndMs: Ms,
): OverlayWindow | undefined {
  if (findEnclosingKeep(keeps, startMs, proposedEndMs) !== undefined) {
    return { startMs, endMs: proposedEndMs };
  }

  const containingKeep = findEnclosingKeep(keeps, startMs, startMs);
  if (containingKeep === undefined) {
    return undefined;
  }

  return clampToKeep(containingKeep, startMs, proposedEndMs);
}

function overlapsAnyPunchIn(
  punchIns: readonly PunchInPlan[],
  startMs: Ms,
  endMs: Ms,
): boolean {
  return punchIns.some((punch) => startMs < punch.endMs && punch.startMs < endMs);
}

function totalKeepDurationMs(keeps: readonly KeepRange[]): number {
  return keeps.reduce((total, keep) => total + (keep.endMs - keep.startMs), 0);
}

export function planBrollOverlays(input: PlanBrollOverlaysInput): PlanBrollOverlaysResult {
  const { concepts, index, keeps, punchIns, preset, fps } = input;
  const occurrences = [...flattenOccurrences(concepts)].sort(compareOccurrences);
  const totalKeepMs = totalKeepDurationMs(keeps);

  const acceptedOverlays: Omit<BrollOverlayPlan, 'id'>[] = [];
  const rejections: BrollRejection[] = [];
  const lastEndMsByAssetId = new Map<string, Ms>();
  let lastOverlayEndMs = -Infinity;
  let coveredMs = 0;

  for (const occurrence of occurrences) {
    const candidate = selectBrollAsset(occurrence.conceptTerm, index, preset);
    if (candidate === undefined) {
      rejections.push({
        conceptTerm: occurrence.conceptTerm,
        startMs: occurrence.startMs,
        assetId: null,
        reason: 'no-candidate',
      });
      continue;
    }

    const rejectWith = (reason: BrollRejectionReason): void => {
      rejections.push({
        conceptTerm: occurrence.conceptTerm,
        startMs: occurrence.startMs,
        assetId: candidate.assetId,
        reason,
      });
    };

    const desiredDurationMs = targetDurationMs(candidate, preset, fps);
    if (desiredDurationMs < preset.broll.minDurationMs) {
      rejectWith('too-short');
      continue;
    }

    const window = resolveOverlayWindow(keeps, occurrence.startMs, occurrence.startMs + desiredDurationMs);
    if (window === undefined || window.endMs - window.startMs < preset.broll.minDurationMs) {
      rejectWith('outside-keep');
      continue;
    }

    if (overlapsAnyPunchIn(punchIns, window.startMs, window.endMs)) {
      rejectWith('punch-in-overlap');
      continue;
    }

    const lastEndMsForAsset = lastEndMsByAssetId.get(candidate.assetId);
    if (
      lastEndMsForAsset !== undefined &&
      window.startMs - lastEndMsForAsset < preset.broll.noRepeatWindowMs
    ) {
      rejectWith('repeat-window');
      continue;
    }

    if (window.startMs - lastOverlayEndMs < preset.broll.minGapMs) {
      rejectWith('overlay-gap');
      continue;
    }

    const overlayDurationMs = window.endMs - window.startMs;
    if ((coveredMs + overlayDurationMs) / totalKeepMs > preset.broll.maxCoverageRatio) {
      rejectWith('coverage-cap');
      continue;
    }

    acceptedOverlays.push({
      startMs: window.startMs,
      endMs: window.endMs,
      assetId: candidate.assetId,
      fit: preset.broll.fit,
      keepVoice: true,
    });
    lastEndMsByAssetId.set(candidate.assetId, window.endMs);
    lastOverlayEndMs = window.endMs;
    coveredMs += overlayDurationMs;
  }

  const overlays = acceptedOverlays.map((overlay, overlayIndex) => ({
    ...overlay,
    id: sequentialId('broll', overlayIndex),
  }));

  return { overlays, rejections };
}
