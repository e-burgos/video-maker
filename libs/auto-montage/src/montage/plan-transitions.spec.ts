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
  it('emite una transición cada preset.transitions.every keeps y aplica direction solo a slide/whip-pan', () => {
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

    const transitions = planTransitions(keeps, preset, FPS, 0);

    expect(transitions.map((t) => [t.id, t.atMs, t.durationMs, t.timing])).toEqual([
      ['trans-0001', 10_000, 1000, 'spring'],
      ['trans-0002', 20_000, 1000, 'spring'],
    ]);
    transitions.forEach((t) => {
      if (t.kind === 'whip-pan') expect(['from-left', 'from-right']).toContain(t.direction);
      else expect(t.direction).toBeUndefined();
    });
  });

  it('rota con semilla: nunca repite el tipo en dos cortes seguidos y la misma semilla da la misma secuencia', () => {
    const keeps = Array.from({ length: 40 }, (_, i) => keep(`keep-${String(i + 1).padStart(4, '0')}`, i * 5000, (i + 1) * 5000));
    const preset = presetWithTransitions({ every: 1, durationMs: 300, kinds: ['whip-pan', 'fade', 'slide'] });

    const first = planTransitions(keeps, preset, FPS, 4);
    const again = planTransitions(keeps, preset, FPS, 4);

    expect(again).toEqual(first);
    first.slice(1).forEach((t, i) => expect(t.kind).not.toBe(first[i]?.kind));
    expect(new Set(first.map((t) => t.kind)).size).toBe(3);
  });

  it('dos semillas distintas dan secuencias distintas para el mismo preset', () => {
    const keeps = Array.from({ length: 20 }, (_, i) => keep(`keep-${String(i + 1).padStart(4, '0')}`, i * 5000, (i + 1) * 5000));
    const preset = presetWithTransitions({ every: 1, durationMs: 300, kinds: ['whip-pan', 'fade', 'slide'] });
    const sequence = (seed: number) => planTransitions(keeps, preset, FPS, seed).map((t) => `${t.kind}:${t.direction ?? ''}`);

    expect(sequence(1)).not.toEqual(sequence(2));
  });

  it('no depende del orden de entrada de los keeps (se ordenan por startMs antes de decidir)', () => {
    const keeps = [
      keep('keep-0001', 0, 5000),
      keep('keep-0002', 5000, 10_000),
      keep('keep-0003', 10_000, 15_000),
    ];
    const preset = presetWithTransitions({ every: 2, durationMs: 1000, kinds: ['fade'] });

    const inOrder = planTransitions(keeps, preset, FPS, 0);
    const reversed = planTransitions([...keeps].reverse(), preset, FPS, 0);

    expect(reversed).toEqual(inOrder);
  });

  it('descarta la transición si su duración no cabe en el más corto de los dos keeps vecinos', () => {
    const keeps = [keep('keep-0001', 0, 5000), keep('keep-0002', 5000, 10_000), keep('keep-0003', 10_000, 10_500)];
    const preset = presetWithTransitions({ every: 2, durationMs: 1000, kinds: ['fade'] });

    expect(planTransitions(keeps, preset, FPS, 0)).toEqual([]);
  });

  it('descarta la transición si su duración redondea a menos de un frame', () => {
    const keeps = [keep('keep-0001', 0, 5000), keep('keep-0002', 5000, 10_000), keep('keep-0003', 10_000, 15_000)];
    const preset = presetWithTransitions({ every: 2, durationMs: 10, kinds: ['fade'] });

    expect(planTransitions(keeps, preset, FPS, 0)).toEqual([]);
  });

  it('un único keep no produce ninguna transición', () => {
    const keeps = [keep('keep-0001', 0, 5000)];

    expect(planTransitions(keeps, softwareDemoPreset, FPS, 0)).toEqual([]);
  });
});
