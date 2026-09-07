import { describe, expect, it } from 'vitest';

import { defaultFormat } from '../format/format';
import type { EditDecision } from '../schemas/edit-decision-list.schema';
import { EditDecisionListSchema } from '../schemas/edit-decision-list.schema';
import type { CutRange, KeepRange } from './prune-silences';
import { pruneSilences } from './prune-silences';

function toDecisions(keeps: readonly KeepRange[], cuts: readonly CutRange[]): EditDecision[] {
  const keepDecisions: EditDecision[] = keeps.map((keep) => ({ type: 'keep', ...keep }));
  const cutDecisions: EditDecision[] = cuts.map((cut) => ({ type: 'cut', ...cut }));
  return [...keepDecisions, ...cutDecisions];
}

function unionCoversWholeAsset(
  keeps: readonly KeepRange[],
  cuts: readonly CutRange[],
  durationMs: number,
): boolean {
  const segments = [...keeps, ...cuts].sort((a, b) => a.startMs - b.startMs);
  let cursor = 0;

  for (const segment of segments) {
    if (segment.startMs !== cursor) {
      return false;
    }
    cursor = segment.endMs;
  }

  return cursor === durationMs;
}

describe('pruneSilences', () => {
  it('CA-005: particiona el asset en keep/cut/keep con padding aplicado a ambos lados', () => {
    const result = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    expect(result.keeps).toEqual([
      { id: 'keep-0001', startMs: 0, endMs: 4080 },
      { id: 'keep-0002', startMs: 4920, endMs: 10_000 },
    ]);
    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 4080, endMs: 4920, reason: 'silence' }]);
    expect(unionCoversWholeAsset(result.keeps, result.cuts, 10_000)).toBe(true);
  });

  it('CA-006: un keep menor a minKeepMs se absorbe en el cut adyacente', () => {
    const result = pruneSilences(2000, [{ startMs: 0, endMs: 900 }]);

    expect(result.keeps).toEqual([{ id: 'keep-0001', startMs: 820, endMs: 2000 }]);
    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 0, endMs: 820, reason: 'silence' }]);
  });

  it('absorbe en cadena: un keep corto entre dos cuts se funde en un único cut', () => {
    const result = pruneSilences(3000, [
      { startMs: 500, endMs: 900 },
      { startMs: 1000, endMs: 1600 },
    ]);

    expect(result.keeps).toEqual([
      { id: 'keep-0001', startMs: 0, endMs: 580 },
      { id: 'keep-0002', startMs: 1520, endMs: 3000 },
    ]);
    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 580, endMs: 1520, reason: 'silence' }]);
    expect(unionCoversWholeAsset(result.keeps, result.cuts, 3000)).toBe(true);
  });

  it('un silencio que cubre todo el asset conserva un único keep mínimo (regla del último keep)', () => {
    const result = pruneSilences(1000, [{ startMs: 0, endMs: 1000 }]);

    expect(result.keeps).toEqual([{ id: 'keep-0001', startMs: 920, endMs: 1000 }]);
    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 0, endMs: 920, reason: 'silence' }]);
    expect(unionCoversWholeAsset(result.keeps, result.cuts, 1000)).toBe(true);
  });

  it('un silencio más corto que 2 x paddingMs no genera ningún cut', () => {
    const result = pruneSilences(2000, [{ startMs: 100, endMs: 150 }]);

    expect(result.cuts).toEqual([]);
    expect(result.keeps).toEqual([{ id: 'keep-0001', startMs: 0, endMs: 2000 }]);
  });

  it('un silencio pegado al inicio del asset no deja un keep inicial degenerado', () => {
    const result = pruneSilences(2000, [{ startMs: 0, endMs: 500 }]);

    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 0, endMs: 420, reason: 'silence' }]);
    expect(result.keeps).toEqual([{ id: 'keep-0001', startMs: 420, endMs: 2000 }]);
  });

  it('un silencio pegado al final del asset no deja un keep final degenerado', () => {
    const result = pruneSilences(10_000, [{ startMs: 9000, endMs: 10_000 }]);

    expect(result.keeps).toEqual([{ id: 'keep-0001', startMs: 0, endMs: 9080 }]);
    expect(result.cuts).toEqual([{ id: 'cut-0001', startMs: 9080, endMs: 10_000, reason: 'silence' }]);
  });

  it('normaliza silencios de entrada contiguos o solapados antes de podar', () => {
    const contiguous = pruneSilences(5000, [
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 2000 },
    ]);
    expect(contiguous.cuts).toEqual([{ id: 'cut-0001', startMs: 1080, endMs: 1920, reason: 'silence' }]);
  });

  it('sin silencios devuelve un único keep de principio a fin', () => {
    expect(pruneSilences(4000, [])).toEqual({
      keeps: [{ id: 'keep-0001', startMs: 0, endMs: 4000 }],
      cuts: [],
    });
  });

  it('devuelve listas vacías cuando durationMs es 0 o negativo', () => {
    expect(pruneSilences(0, [{ startMs: 0, endMs: 100 }])).toEqual({ keeps: [], cuts: [] });
    expect(pruneSilences(-100, [])).toEqual({ keeps: [], cuts: [] });
  });

  it('la salida valida como EditDecisionList cuando se envuelve en una EDL completa', () => {
    const { keeps, cuts } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);

    const result = EditDecisionListSchema.safeParse({
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: defaultFormat('reels-9x16'),
      generatedBy: { tool: 'prune.spec', params: {} },
      decisions: toDecisions(keeps, cuts),
    });

    expect(result.success).toBe(true);
  });
});
