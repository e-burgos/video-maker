import type { KeepRange, Word } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import type { Concept } from '../concepts/concept';
import { softwareDemoPreset } from '../presets/software-demo.preset';
import { planCaptionGroups } from './plan-caption-groups';

function keep(id: string, startMs: number, endMs: number): KeepRange {
  return { id, startMs, endMs };
}

function word(text: string, startMs: number, endMs: number, confidence?: number): Word {
  return confidence === undefined ? { text, startMs, endMs } : { text, startMs, endMs, confidence };
}

describe('planCaptionGroups (§6 paso 5)', () => {
  it('mapea explícitamente las palabras: la clave "confidence" no llega al EditDecisionList', () => {
    const words = [word('hola', 0, 300, 0.87)];
    const keeps = [keep('keep-0001', 0, 2000)];

    const decisions = planCaptionGroups(words, keeps, [], softwareDemoPreset);

    expect(decisions).toEqual([
      {
        id: 'cap-0001',
        type: 'caption-group',
        startMs: 0,
        endMs: 300,
        words: [{ text: 'hola', startMs: 0, endMs: 300 }],
        emphasisIndex: 0,
      },
    ]);
  });

  it('clampea endMs al final del keep cuando extendedEndMs (minDurationMs) lo excede', () => {
    const words = [word('hola', 900, 1000)];
    const keeps = [keep('keep-0001', 0, 1000)];
    const preset = {
      ...softwareDemoPreset,
      captions: { ...softwareDemoPreset.captions, minDurationMs: 2000 },
    };

    const decisions = planCaptionGroups(words, keeps, [], preset);

    expect(decisions).toEqual([
      {
        id: 'cap-0001',
        type: 'caption-group',
        startMs: 900,
        endMs: 1000,
        words: [{ text: 'hola', startMs: 900, endMs: 1000 }],
        emphasisIndex: 0,
      },
    ]);
  });

  it('descarta un grupo cuyo fin recortado al keep no supera su inicio (FIX-e-burgos-002-003)', () => {
    const words = [word('Hoy', 3980, 3980), word('te', 3980, 3980)];
    const keeps = [keep('keep-0001', 0, 3980), keep('keep-0002', 4300, 9000)];

    const decisions = planCaptionGroups(words, keeps, [], softwareDemoPreset);

    expect(decisions).toEqual([]);
  });

  it('descarta un grupo cuyas palabras caen fuera de todo keep (D-11/RN-14)', () => {
    const words = [word('fuera', 800, 900)];
    const keeps = [keep('keep-0001', 0, 500), keep('keep-0002', 2000, 3000)];

    expect(planCaptionGroups(words, keeps, [], softwareDemoPreset)).toEqual([]);
  });

  it('reasigna ids de forma contigua sobre los grupos que sobreviven al descarte', () => {
    const words = [word('fuera', 800, 900), word('dentro', 2100, 2200)];
    const keeps = [keep('keep-0001', 0, 500), keep('keep-0002', 2000, 3000)];

    const decisions = planCaptionGroups(words, keeps, [], softwareDemoPreset);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.id).toBe('cap-0001');
    expect(decisions[0]?.words).toEqual([{ text: 'dentro', startMs: 2100, endMs: 2200 }]);
  });

  it('usa los términos de concepto como emphasisKeywords', () => {
    const words = [word('hola', 0, 200), word('python', 200, 600), word('mundo', 600, 800)];
    const keeps = [keep('keep-0001', 0, 2000)];
    const concepts: Concept[] = [
      {
        term: 'python',
        source: 'dictionary',
        occurrences: [{ startMs: 200, endMs: 600, wordIndex: 1, wordCount: 1 }],
      },
      {
        term: 'mundo',
        source: 'frequency',
        occurrences: [{ startMs: 600, endMs: 800, wordIndex: 2, wordCount: 1 }],
      },
    ];

    const decisions = planCaptionGroups(words, keeps, concepts, softwareDemoPreset);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.emphasisIndex).toBe(1);
  });
});
