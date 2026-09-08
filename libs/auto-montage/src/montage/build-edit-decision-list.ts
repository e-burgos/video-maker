import type {
  BrollOverlayDecision,
  CaptionGroupDecision,
  CutDecision,
  CutRange,
  DuckDecision,
  EditDecision,
  EditDecisionList,
  KeepDecision,
  KeepRange,
  OutputFormat,
  PunchInDecision,
  PunchInPlan,
  TransitionDecision,
} from '@video-maker/timeline-core';

import type { BrollOverlayPlan } from '../broll/plan-broll-overlays';

export interface BuildEditDecisionListInput {
  readonly sourceAssetId: string;
  readonly format: OutputFormat;
  readonly presetName: string;
  readonly seed: number;
  readonly keeps: readonly KeepRange[];
  readonly cuts: readonly CutRange[];
  readonly punchIns: readonly PunchInPlan[];
  readonly brollOverlays: readonly BrollOverlayPlan[];
  readonly transitions: readonly TransitionDecision[];
  readonly captionGroups: readonly CaptionGroupDecision[];
  readonly duckDecisions: readonly DuckDecision[];
}

function byStartMsAscending<T extends { startMs: number }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.startMs - right.startMs);
}

function toKeepDecision(keep: KeepRange): KeepDecision {
  return { id: keep.id, type: 'keep', startMs: keep.startMs, endMs: keep.endMs };
}

function toCutDecision(cut: CutRange): CutDecision {
  return { id: cut.id, type: 'cut', startMs: cut.startMs, endMs: cut.endMs, reason: cut.reason };
}

function toPunchInDecision(punch: PunchInPlan): PunchInDecision {
  return {
    id: punch.id,
    type: 'punch-in',
    startMs: punch.startMs,
    endMs: punch.endMs,
    scale: punch.scale,
    anchor: punch.anchor,
  };
}

function toBrollOverlayDecision(overlay: BrollOverlayPlan): BrollOverlayDecision {
  return {
    id: overlay.id,
    type: 'broll-overlay',
    startMs: overlay.startMs,
    endMs: overlay.endMs,
    assetId: overlay.assetId,
    fit: overlay.fit,
    keepVoice: overlay.keepVoice,
  };
}

export function buildEditDecisionList(input: BuildEditDecisionListInput): EditDecisionList {
  const decisions: EditDecision[] = [
    ...byStartMsAscending(input.keeps).map(toKeepDecision),
    ...byStartMsAscending(input.cuts).map(toCutDecision),
    ...byStartMsAscending(input.punchIns).map(toPunchInDecision),
    ...byStartMsAscending(input.brollOverlays).map(toBrollOverlayDecision),
    ...[...input.transitions].sort((left, right) => left.atMs - right.atMs),
    ...byStartMsAscending(input.captionGroups),
    ...byStartMsAscending(input.duckDecisions),
  ];

  return {
    schemaVersion: 1,
    sourceAssetId: input.sourceAssetId,
    format: input.format,
    generatedBy: { tool: 'auto-montage', params: { preset: input.presetName, seed: input.seed } },
    decisions,
  };
}
