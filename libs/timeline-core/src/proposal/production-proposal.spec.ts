import { describe, expect, it } from 'vitest';

import {
  ProductionProposalDraftSchema,
  ProductionProposalSchema,
  approveProposalConcept,
  pendingProposalFrom,
} from './production-proposal';
import type { ProposalConcept } from './production-proposal';

function concept(id: string, overrides: Partial<ProposalConcept> = {}): ProposalConcept {
  return {
    id,
    title: `Concepto ${id}`,
    angle: 'Tutorial directo, paso a paso',
    format: 'youtube-16x9',
    durationSec: 60,
    scenes: 8,
    delivery: { kind: 'tutorial', requiresVoice: true },
    ...overrides,
  };
}

const DRAFT = { recommendedId: 'directo', concepts: [concept('directo'), concept('reel', { format: 'reels-9x16', durationSec: 30 })] };

describe('ProductionProposalSchema', () => {
  it('accepts a pending proposal with two concepts', () => {
    expect(ProductionProposalSchema.safeParse(pendingProposalFrom(DRAFT)).success).toBe(true);
  });

  it.each([
    ['one concept', { ...DRAFT, concepts: [concept('directo')] }],
    ['four concepts', { ...DRAFT, concepts: ['a', 'b', 'c', 'd'].map((id) => concept(id)), recommendedId: 'a' }],
    ['duplicate ids', { ...DRAFT, concepts: [concept('directo'), concept('directo')] }],
    ['recommended outside the concepts', { ...DRAFT, recommendedId: 'otro' }],
    ['unknown preset', { ...DRAFT, concepts: [concept('directo', { format: 'cinema' as never }), concept('reel')] }],
    ['unknown key', { ...DRAFT, extra: true }],
  ])('rejects %s', (_label, draft) => {
    expect(ProductionProposalDraftSchema.safeParse(draft).success).toBe(false);
  });

  it('rejects a pending proposal that carries an approval', () => {
    const pending = { ...pendingProposalFrom(DRAFT), approvedConceptId: 'directo' };
    expect(ProductionProposalSchema.safeParse(pending).success).toBe(false);
  });

  it('rejects an approved proposal without a valid concept or date', () => {
    const approved = { ...pendingProposalFrom(DRAFT), status: 'approved' as const };
    expect(ProductionProposalSchema.safeParse(approved).success).toBe(false);
    expect(ProductionProposalSchema.safeParse({ ...approved, approvedConceptId: 'nope', approvedAt: '2026-10-12T10:00:00.000Z' }).success).toBe(false);
  });
});

describe('approveProposalConcept', () => {
  it('marks the proposal approved with the chosen concept and date', () => {
    const approved = approveProposalConcept(pendingProposalFrom(DRAFT), 'reel', '2026-10-12T10:00:00.000Z');

    expect(approved).toMatchObject({ status: 'approved', approvedConceptId: 'reel', approvedAt: '2026-10-12T10:00:00.000Z' });
    expect(ProductionProposalSchema.safeParse(approved).success).toBe(true);
  });

  it('answers null for a concept the proposal does not have', () => {
    expect(approveProposalConcept(pendingProposalFrom(DRAFT), 'nope', '2026-10-12T10:00:00.000Z')).toBeNull();
  });
});
