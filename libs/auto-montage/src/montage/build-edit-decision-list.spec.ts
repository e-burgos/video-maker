import { defaultFormat } from '@video-maker/timeline-core';
import type {
  CaptionGroupDecision,
  CutRange,
  DuckDecision,
  KeepRange,
  PunchInPlan,
  TransitionDecision,
} from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import type { BrollOverlayPlan } from '../broll/plan-broll-overlays';
import { buildEditDecisionList } from './build-edit-decision-list';

describe('buildEditDecisionList (§7)', () => {
  it('agrupa por tipo en el orden fijo y ordena cada grupo por startMs (atMs para transiciones)', () => {
    const keeps: KeepRange[] = [
      { id: 'keep-0002', startMs: 5000, endMs: 8000 },
      { id: 'keep-0001', startMs: 0, endMs: 4000 },
    ];
    const cuts: CutRange[] = [{ id: 'cut-0001', startMs: 4000, endMs: 5000, reason: 'silence' }];
    const punchIns: PunchInPlan[] = [
      { id: 'punch-0001', startMs: 1000, endMs: 2000, scale: 1.1, anchor: 'center', keepId: 'keep-0001' },
    ];
    const brollOverlays: BrollOverlayPlan[] = [
      { id: 'broll-0001', startMs: 6000, endMs: 6500, assetId: 'raw/broll/x.mp4', fit: 'cover', keepVoice: true },
    ];
    const transitions: TransitionDecision[] = [
      { id: 'trans-0002', type: 'transition', atMs: 9000, durationMs: 200, kind: 'fade', timing: 'linear' },
      { id: 'trans-0001', type: 'transition', atMs: 5000, durationMs: 200, kind: 'fade', timing: 'linear' },
    ];
    const captionGroups: CaptionGroupDecision[] = [
      { id: 'cap-0001', type: 'caption-group', startMs: 0, endMs: 300, words: [{ text: 'hola', startMs: 0, endMs: 300 }], emphasisIndex: 0 },
    ];
    const duckDecisions: DuckDecision[] = [
      { id: 'duck-0001', type: 'duck', startMs: 0, endMs: 300, gainDb: -22 },
    ];

    const edl = buildEditDecisionList({
      sourceAssetId: 'raw/aroll/a.mp4',
      format: defaultFormat('reels-9x16'),
      presetName: 'software-demo',
      seed: 7,
      keeps,
      cuts,
      punchIns,
      brollOverlays,
      transitions,
      captionGroups,
      duckDecisions,
    });

    expect(edl.decisions.map((decision) => decision.type)).toEqual([
      'keep',
      'keep',
      'cut',
      'punch-in',
      'broll-overlay',
      'transition',
      'transition',
      'caption-group',
      'duck',
    ]);
    expect(edl.decisions.map((decision) => decision.id)).toEqual([
      'keep-0001',
      'keep-0002',
      'cut-0001',
      'punch-0001',
      'broll-0001',
      'trans-0001',
      'trans-0002',
      'cap-0001',
      'duck-0001',
    ]);
    expect(edl.generatedBy).toEqual({ tool: 'auto-montage', params: { preset: 'software-demo', seed: 7 } });
  });
});
