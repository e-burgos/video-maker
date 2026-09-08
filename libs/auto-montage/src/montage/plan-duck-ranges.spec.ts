import type { KeepRange, Word } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { softwareDemoPreset } from '../presets/software-demo.preset';
import { planDuckRanges } from './plan-duck-ranges';

const FPS = 30;

function keep(id: string, startMs: number, endMs: number): KeepRange {
  return { id, startMs, endMs };
}

function word(text: string, startMs: number, endMs: number): Word {
  return { text, startMs, endMs };
}

describe('planDuckRanges (§6 paso 6)', () => {
  it('produce una decisión de duck cuando el rango de voz cae dentro de un único keep', () => {
    const words = [word('a', 1000, 1500)];
    const keeps = [keep('keep-0001', 0, 5000)];

    const decisions = planDuckRanges(words, keeps, softwareDemoPreset, FPS);

    expect(decisions).toEqual([
      {
        id: 'duck-0001',
        type: 'duck',
        startMs: 1000,
        endMs: 1500,
        gainDb: softwareDemoPreset.audio.duckedGainDb,
      },
    ]);
  });

  it('clampea endMs al final del keep cuando el rango de voz lo excede', () => {
    const words = [word('a', 1000, 1500)];
    const keeps = [keep('keep-0001', 0, 1200)];

    const decisions = planDuckRanges(words, keeps, softwareDemoPreset, FPS);

    expect(decisions).toEqual([
      {
        id: 'duck-0001',
        type: 'duck',
        startMs: 1000,
        endMs: 1200,
        gainDb: softwareDemoPreset.audio.duckedGainDb,
      },
    ]);
  });

  it('descarta un rango de voz que cae fuera de todo keep (D-11)', () => {
    const words = [word('fuera', 800, 900)];
    const keeps = [keep('keep-0001', 0, 500), keep('keep-0002', 2000, 3000)];

    expect(planDuckRanges(words, keeps, softwareDemoPreset, FPS)).toEqual([]);
  });

  it('reasigna ids de forma contigua sobre las decisiones que sobreviven al descarte', () => {
    const words = [word('fuera', 800, 900), word('dentro', 2100, 2200)];
    const keeps = [keep('keep-0001', 0, 500), keep('keep-0002', 2000, 3000)];

    const decisions = planDuckRanges(words, keeps, softwareDemoPreset, FPS);

    expect(decisions).toEqual([
      {
        id: 'duck-0001',
        type: 'duck',
        startMs: 2100,
        endMs: 2200,
        gainDb: softwareDemoPreset.audio.duckedGainDb,
      },
    ]);
  });
});
