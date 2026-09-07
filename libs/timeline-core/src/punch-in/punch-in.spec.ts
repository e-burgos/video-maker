import { describe, expect, it } from 'vitest';

import { defaultFormat } from '../format/format';
import type { EditDecision } from '../schemas/edit-decision-list.schema';
import { EditDecisionListSchema } from '../schemas/edit-decision-list.schema';
import { pruneSilences } from '../silence/prune-silences';
import type { CutRange, KeepRange } from '../silence/prune-silences';
import type { PunchInPlan } from './plan-punch-ins';
import { planPunchIns } from './plan-punch-ins';

const PUNCH_IN_SCALE_RANGE = [1.1, 1.15] as const;

function fiveEvenKeeps(): KeepRange[] {
  return [
    { id: 'keep-0001', startMs: 0, endMs: 1000 },
    { id: 'keep-0002', startMs: 1000, endMs: 2000 },
    { id: 'keep-0003', startMs: 2000, endMs: 3000 },
    { id: 'keep-0004', startMs: 3000, endMs: 4000 },
    { id: 'keep-0005', startMs: 4000, endMs: 5000 },
  ];
}

function toPunchInDecisions(plans: readonly PunchInPlan[]): EditDecision[] {
  return plans.map((plan) => ({
    id: plan.id,
    type: 'punch-in',
    startMs: plan.startMs,
    endMs: plan.endMs,
    scale: plan.scale,
    anchor: plan.anchor,
  }));
}

function toKeepAndCutDecisions(
  keeps: readonly KeepRange[],
  cuts: readonly CutRange[],
): EditDecision[] {
  const keepDecisions: EditDecision[] = keeps.map((keep) => ({ type: 'keep', ...keep }));
  const cutDecisions: EditDecision[] = cuts.map((cut) => ({ type: 'cut', ...cut }));
  return [...keepDecisions, ...cutDecisions];
}

describe('planPunchIns', () => {
  it('CA-007: con 5 keeps, every:2 y seed:7 ubica punch-ins en el 2.º y 4.º keep con escala en [1.10, 1.15]', () => {
    const result = planPunchIns(fiveEvenKeeps(), { seed: 7, every: 2, scales: [1.1, 1.15] });

    expect(result).toEqual([
      { id: 'punch-0001', startMs: 1000, endMs: 2000, scale: 1.1, anchor: 'center', keepId: 'keep-0002' },
      { id: 'punch-0002', startMs: 3000, endMs: 4000, scale: 1.1, anchor: 'center', keepId: 'keep-0004' },
    ]);
    for (const plan of result) {
      expect(PUNCH_IN_SCALE_RANGE).toContain(plan.scale);
    }
  });

  it('CA-007: la misma llamada con el mismo seed produce un resultado idéntico', () => {
    const opts = { seed: 7, every: 2, scales: [1.1, 1.15] as const };
    const first = planPunchIns(fiveEvenKeeps(), opts);
    const second = planPunchIns(fiveEvenKeeps(), opts);

    expect(first).toEqual(second);
  });

  it('sin keeps devuelve una lista vacía', () => {
    expect(planPunchIns([], { seed: 1 })).toEqual([]);
  });

  it('un único keep con every:1 produce un punch-in que cubre el keep completo', () => {
    const keep: KeepRange = { id: 'keep-0001', startMs: 0, endMs: 500 };

    expect(planPunchIns([keep], { seed: 3, every: 1 })).toEqual([
      { id: 'punch-0001', startMs: 0, endMs: 500, scale: 1.15, anchor: 'center', keepId: 'keep-0001' },
    ]);
  });

  it('un único keep con every:2 no produce ningún punch-in', () => {
    const keep: KeepRange = { id: 'keep-0001', startMs: 0, endMs: 500 };

    expect(planPunchIns([keep], { seed: 3, every: 2 })).toEqual([]);
  });

  it('every:1 selecciona todos los keeps', () => {
    const result = planPunchIns(fiveEvenKeeps(), { seed: 3, every: 1 });

    expect(result).toHaveLength(5);
    expect(result.map((plan) => plan.keepId)).toEqual([
      'keep-0001',
      'keep-0002',
      'keep-0003',
      'keep-0004',
      'keep-0005',
    ]);
  });

  it('every mayor que la cantidad de keeps no produce ningún punch-in', () => {
    expect(planPunchIns(fiveEvenKeeps(), { seed: 3, every: 10 })).toEqual([]);
  });

  it('con una única escala configurada, siempre se usa esa escala', () => {
    const result = planPunchIns(fiveEvenKeeps(), { seed: 3, every: 1, scales: [1.2] });

    expect(result.every((plan) => plan.scale === 1.2)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('seeds distintos producen secuencias distintas pero siempre dentro del rango de scales', () => {
    const keeps = fiveEvenKeeps();
    const withSeed7 = planPunchIns(keeps, { seed: 7, every: 1, scales: [1.1, 1.15] });
    const withSeed42 = planPunchIns(keeps, { seed: 42, every: 1, scales: [1.1, 1.15] });

    expect(withSeed7.map((plan) => plan.scale)).not.toEqual(withSeed42.map((plan) => plan.scale));
    for (const plan of [...withSeed7, ...withSeed42]) {
      expect(PUNCH_IN_SCALE_RANGE).toContain(plan.scale);
    }
  });

  it('la salida valida como EditDecisionList cuando se combina con los keeps y cuts que la originan', () => {
    const { keeps, cuts } = pruneSilences(10_000, [{ startMs: 4000, endMs: 5000 }]);
    const punchIns = planPunchIns(keeps, { seed: 7, every: 1 });

    const result = EditDecisionListSchema.safeParse({
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: defaultFormat('reels-9x16'),
      generatedBy: { tool: 'punch-in.spec', params: {} },
      decisions: [...toKeepAndCutDecisions(keeps, cuts), ...toPunchInDecisions(punchIns)],
    });

    expect(result.success).toBe(true);
  });
});
