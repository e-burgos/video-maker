import type { KeepRange, PunchInPlan } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import type { Concept } from '../concepts/concept';
import { softwareDemoPreset } from '../presets/software-demo.preset';
import type { MontagePreset } from '../presets/montage-preset';
import type { BrollCandidate } from './build-broll-index';
import { planBrollOverlays } from './plan-broll-overlays';

const FPS = 30;

function candidate(
  assetId: string,
  tokens: readonly string[],
  overrides: Partial<BrollCandidate> = {},
): BrollCandidate {
  return { assetId, role: 'broll', kind: 'video', durationMs: 60_000, tokens: new Set(tokens), ...overrides };
}

function concept(
  term: string,
  occurrences: readonly { startMs: number; endMs: number }[],
  source: Concept['source'] = 'dictionary',
): Concept {
  return {
    term,
    source,
    occurrences: occurrences.map((occurrence, index) => ({
      startMs: occurrence.startMs,
      endMs: occurrence.endMs,
      wordIndex: index,
      wordCount: 1,
    })),
  };
}

function keep(id: string, startMs: number, endMs: number): KeepRange {
  return { id, startMs, endMs };
}

function punchIn(startMs: number, endMs: number): PunchInPlan {
  return { id: 'punch-0001', startMs, endMs, scale: 1.1, anchor: 'center', keepId: 'keep-0001' };
}

function presetOverride(overrides: Partial<MontagePreset['broll']>): MontagePreset {
  return { ...softwareDemoPreset, broll: { ...softwareDemoPreset.broll, ...overrides } };
}

describe('planBrollOverlays (CA-009 §5.4)', () => {
  it('ninguna superposición solapa, total ni parcialmente, un punch-in ya planificado', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 1000, endMs: 1100 }])];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const punchIns = [punchIn(3000, 4000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns,
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays).toEqual([]);
    expect(result.rejections).toEqual([
      {
        conceptTerm: 'python',
        startMs: 1000,
        assetId: 'raw/broll/python.mp4',
        reason: 'punch-in-overlap',
      },
    ]);
  });

  it('un concepto sin candidato y otro rechazado por punch-in no interrumpen la planificación del resto', () => {
    const index = [
      candidate('raw/broll/python.mp4', ['python']),
      candidate('raw/broll/code.mp4', ['code']),
    ];
    const concepts = [
      concept('linux', [{ startMs: 100, endMs: 200 }]),
      concept('python', [{ startMs: 2500, endMs: 2600 }]),
      concept('code', [{ startMs: 20_000, endMs: 20_100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const punchIns = [punchIn(2000, 4000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns,
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.rejections).toEqual([
      { conceptTerm: 'linux', startMs: 100, assetId: null, reason: 'no-candidate' },
      {
        conceptTerm: 'python',
        startMs: 2500,
        assetId: 'raw/broll/python.mp4',
        reason: 'punch-in-overlap',
      },
    ]);
    expect(result.overlays).toEqual([
      {
        id: 'broll-0001',
        startMs: 20_000,
        endMs: 22_500,
        assetId: 'raw/broll/code.mp4',
        fit: 'cover',
        keepVoice: true,
      },
    ]);
  });

  it('rama de clamp por duración máxima: el overlay nunca excede preset.broll.maxDurationMs', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 0, endMs: 100 }])];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const preset = presetOverride({ targetDurationMs: 999_999 });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays[0]?.endMs).toBe(preset.broll.maxDurationMs);
  });

  it('rama de clamp por duración mínima: el overlay nunca queda por debajo de preset.broll.minDurationMs', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 0, endMs: 100 }])];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const preset = presetOverride({ targetDurationMs: 1 });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays[0]?.endMs).toBe(preset.broll.minDurationMs);
  });

  it('rama "too-short" (D-12): un asset de video demasiado corto para minDurationMs se descarta', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'], { durationMs: 1000 })];
    const concepts = [concept('python', [{ startMs: 0, endMs: 100 }])];
    const keeps = [keep('keep-0001', 0, 60_000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays).toEqual([]);
    expect(result.rejections).toEqual([
      { conceptTerm: 'python', startMs: 0, assetId: 'raw/broll/python.mp4', reason: 'too-short' },
    ]);
  });

  it('D-12: una imagen nunca se capa por duración aunque asset.durationMs sea 0', () => {
    const index = [
      candidate('raw/images/python.jpg', ['python'], { role: 'image', kind: 'image', durationMs: 0 }),
    ];
    const concepts = [concept('python', [{ startMs: 0, endMs: 100 }])];
    const keeps = [keep('keep-0001', 0, 60_000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays[0]?.endMs).toBe(softwareDemoPreset.broll.targetDurationMs);
  });

  it('rama "outside-keep": una ocurrencia dentro de un keep absorbido (cut) se descarta visible (D-19)', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 5000, endMs: 5100 }])];
    const keeps = [keep('keep-0001', 0, 2000), keep('keep-0002', 8000, 20_000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays).toEqual([]);
    expect(result.rejections).toEqual([
      { conceptTerm: 'python', startMs: 5000, assetId: 'raw/broll/python.mp4', reason: 'outside-keep' },
    ]);
  });

  it('rama "outside-keep": una ocurrencia que se pasa del final del keep se clampea si alcanza minDurationMs', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 8000, endMs: 8100 }])];
    const keeps = [keep('keep-0001', 0, 9500)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays).toEqual([
      {
        id: 'broll-0001',
        startMs: 8000,
        endMs: 9500,
        assetId: 'raw/broll/python.mp4',
        fit: 'cover',
        keepVoice: true,
      },
    ]);
  });

  it('rama "outside-keep": si la duración clampeada queda por debajo de minDurationMs, se descarta', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [concept('python', [{ startMs: 9400, endMs: 9450 }])];
    const keeps = [keep('keep-0001', 0, 9500)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays).toEqual([]);
    expect(result.rejections).toEqual([
      { conceptTerm: 'python', startMs: 9400, assetId: 'raw/broll/python.mp4', reason: 'outside-keep' },
    ]);
  });

  it('rama "repeat-window": la ventana de no-repetición del preset impide reutilizar un asset antes de tiempo', () => {
    const index = [candidate('raw/broll/python.mp4', ['python'])];
    const concepts = [
      concept('python', [
        { startMs: 0, endMs: 100 },
        { startMs: 3000, endMs: 3100 },
      ]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const preset = presetOverride({ noRepeatWindowMs: 10_000, minGapMs: 0 });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]?.startMs).toBe(0);
    expect(result.rejections).toEqual([
      { conceptTerm: 'python', startMs: 3000, assetId: 'raw/broll/python.mp4', reason: 'repeat-window' },
    ]);
  });

  it('RN-15: dos conceptos que compiten por el mismo asset resuelven determinista por orden cronológico', () => {
    const index = [candidate('raw/broll/python.mp4', ['python', 'code'])];
    const concepts = [
      concept('python', [{ startMs: 0, endMs: 100 }]),
      concept('code', [{ startMs: 3000, endMs: 3100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const preset = presetOverride({ noRepeatWindowMs: 10_000, minGapMs: 0 });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays).toHaveLength(1);
    expect(result.rejections).toEqual([
      { conceptTerm: 'code', startMs: 3000, assetId: 'raw/broll/python.mp4', reason: 'repeat-window' },
    ]);
  });

  it('rama "overlay-gap": dos overlays de assets distintos no pueden pegarse por debajo de minGapMs', () => {
    const index = [
      candidate('raw/broll/python.mp4', ['python']),
      candidate('raw/broll/code.mp4', ['code']),
    ];
    const concepts = [
      concept('python', [{ startMs: 0, endMs: 100 }]),
      concept('code', [{ startMs: 3000, endMs: 3100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];
    const preset = presetOverride({ noRepeatWindowMs: 0, minGapMs: 10_000 });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]?.assetId).toBe('raw/broll/python.mp4');
    expect(result.rejections).toEqual([
      { conceptTerm: 'code', startMs: 3000, assetId: 'raw/broll/code.mp4', reason: 'overlay-gap' },
    ]);
  });

  it('rama "coverage-cap": no se supera la densidad máxima de B-roll del preset', () => {
    const index = [
      candidate('raw/broll/python.mp4', ['python']),
      candidate('raw/broll/code.mp4', ['code']),
    ];
    const concepts = [
      concept('python', [{ startMs: 0, endMs: 100 }]),
      concept('code', [{ startMs: 10_000, endMs: 10_100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 20_000)];
    const preset = presetOverride({
      noRepeatWindowMs: 0,
      minGapMs: 0,
      targetDurationMs: 3000,
      maxCoverageRatio: 0.2,
    });

    const result = planBrollOverlays({ concepts, index, keeps, punchIns: [], preset, fps: FPS });

    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]?.assetId).toBe('raw/broll/python.mp4');
    expect(result.rejections).toEqual([
      { conceptTerm: 'code', startMs: 10_000, assetId: 'raw/broll/code.mp4', reason: 'coverage-cap' },
    ]);
  });

  it('desempate teórico del barrido (§5.4 paso 2): a igual startMs, dictionary antes que frequency; a igual todo, term ascendente', () => {
    const concepts = [
      concept('alpha', [{ startMs: 1000, endMs: 1100 }], 'frequency'),
      concept('zebra', [{ startMs: 1000, endMs: 1100 }]),
      concept('gamma', [{ startMs: 2000, endMs: 2100 }]),
      concept('beta', [{ startMs: 2000, endMs: 2100 }]),
      concept('alfa', [{ startMs: 3000, endMs: 3100 }]),
      concept('zulu', [{ startMs: 3000, endMs: 3100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];

    const result = planBrollOverlays({
      concepts,
      index: [],
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.rejections.map((rejection) => rejection.conceptTerm)).toEqual([
      'zebra',
      'alpha',
      'beta',
      'gamma',
      'alfa',
      'zulu',
    ]);
  });

  it('los ids se asignan de forma contigua sobre la lista aceptada, sin huecos por los rechazos', () => {
    const index = [
      candidate('raw/broll/alpha.mp4', ['alpha']),
      candidate('raw/broll/beta.mp4', ['beta']),
    ];
    const concepts = [
      concept('missing', [{ startMs: 0, endMs: 100 }]),
      concept('alpha', [{ startMs: 1000, endMs: 1100 }]),
      concept('beta', [{ startMs: 10_000, endMs: 10_100 }]),
    ];
    const keeps = [keep('keep-0001', 0, 60_000)];

    const result = planBrollOverlays({
      concepts,
      index,
      keeps,
      punchIns: [],
      preset: softwareDemoPreset,
      fps: FPS,
    });

    expect(result.overlays.map((overlay) => overlay.id)).toEqual(['broll-0001', 'broll-0002']);
  });
});
