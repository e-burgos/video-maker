import type { KeepRange } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { softwareDemoPreset } from '../presets/software-demo.preset';
import type { MontagePreset } from '../presets/montage-preset';
import { planTransitions } from './plan-transitions';

const FPS = 30;

function keep(id: string, startMs: number, endMs: number): KeepRange {
  return { id, startMs, endMs };
}

function presetWithTransitions(overrides: Partial<MontagePreset['transitions']>): MontagePreset {
  return { ...softwareDemoPreset, transitions: { ...softwareDemoPreset.transitions, ...overrides } };
}

describe('planTransitions (§6 paso 7)', () => {
  it('emite una transición cada preset.transitions.every keeps, cicla kind y aplica direction solo a slide/whip-pan', () => {
    const keeps = [
      keep('keep-0001', 0, 5000),
      keep('keep-0002', 5000, 10_000),
      keep('keep-0003', 10_000, 15_000),
      keep('keep-0004', 15_000, 20_000),
      keep('keep-0005', 20_000, 25_000),
    ];
    const preset = presetWithTransitions({
      every: 2,
      durationMs: 1000,
      kinds: ['whip-pan', 'fade'],
      timing: 'spring',
    });

    const transitions = planTransitions(keeps, preset, FPS);

    expect(transitions).toEqual([
      {
        id: 'trans-0001',
        type: 'transition',
        atMs: 10_000,
        durationMs: 1000,
        kind: 'whip-pan',
        direction: 'from-left',
        timing: 'spring',
      },
      {
        id: 'trans-0002',
        type: 'transition',
        atMs: 20_000,
        durationMs: 1000,
        kind: 'fade',
        timing: 'spring',
      },
    ]);
  });

  it('no depende del orden de entrada de los keeps (se ordenan por startMs antes de decidir)', () => {
    const keeps = [
      keep('keep-0001', 0, 5000),
      keep('keep-0002', 5000, 10_000),
      keep('keep-0003', 10_000, 15_000),
    ];
    const preset = presetWithTransitions({ every: 2, durationMs: 1000, kinds: ['fade'] });

    const inOrder = planTransitions(keeps, preset, FPS);
    const reversed = planTransitions([...keeps].reverse(), preset, FPS);

    expect(reversed).toEqual(inOrder);
  });

  it('descarta la transición si su duración no cabe en el más corto de los dos keeps vecinos', () => {
    const keeps = [keep('keep-0001', 0, 5000), keep('keep-0002', 5000, 10_000), keep('keep-0003', 10_000, 10_500)];
    const preset = presetWithTransitions({ every: 2, durationMs: 1000, kinds: ['fade'] });

    expect(planTransitions(keeps, preset, FPS)).toEqual([]);
  });

  it('descarta la transición si su duración redondea a menos de un frame', () => {
    const keeps = [keep('keep-0001', 0, 5000), keep('keep-0002', 5000, 10_000), keep('keep-0003', 10_000, 15_000)];
    const preset = presetWithTransitions({ every: 2, durationMs: 10, kinds: ['fade'] });

    expect(planTransitions(keeps, preset, FPS)).toEqual([]);
  });

  it('un único keep no produce ninguna transición', () => {
    const keeps = [keep('keep-0001', 0, 5000)];

    expect(planTransitions(keeps, softwareDemoPreset, FPS)).toEqual([]);
  });
});
