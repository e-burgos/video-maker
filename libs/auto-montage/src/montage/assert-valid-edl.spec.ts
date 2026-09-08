import { defaultFormat } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { EditDecisionListInvalidError } from '../errors/edit-decision-list-invalid-error';
import { assertValidEditDecisionList } from './assert-valid-edl';

function validEdlCandidate(): unknown {
  return {
    schemaVersion: 1,
    sourceAssetId: 'raw/aroll/camara.mp4',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'auto-montage', params: { preset: 'software-demo', seed: 1 } },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 }],
  };
}

describe('assertValidEditDecisionList (D-20)', () => {
  it('devuelve el EDL parseado cuando es válido', () => {
    const parsed = assertValidEditDecisionList(validEdlCandidate());

    expect(parsed.sourceAssetId).toBe('raw/aroll/camara.mp4');
    expect(parsed.decisions).toHaveLength(1);
  });

  it('lanza EditDecisionListInvalidError con los issues y el sourceAssetId cuando la partición keep/cut no arranca en 0', () => {
    const candidate = {
      ...validEdlCandidate(),
      decisions: [{ id: 'keep-0001', type: 'keep', startMs: 100, endMs: 2000 }],
    };

    expect(() => assertValidEditDecisionList(candidate)).toThrow(EditDecisionListInvalidError);

    try {
      assertValidEditDecisionList(candidate);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EditDecisionListInvalidError);
      expect((error as EditDecisionListInvalidError).sourceAssetId).toBe('raw/aroll/camara.mp4');
      expect((error as EditDecisionListInvalidError).issues.length).toBeGreaterThan(0);
    }
  });

  it('usa "unknown" como sourceAssetId cuando el candidato ni siquiera es un objeto reconocible', () => {
    try {
      assertValidEditDecisionList('not-an-edl');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EditDecisionListInvalidError);
      expect((error as EditDecisionListInvalidError).sourceAssetId).toBe('unknown');
    }
  });
});
