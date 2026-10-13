import { z } from 'zod';

import { OutputPresetSchema } from '../schemas/output-format.schema';
import { DeliveryContractSchema } from '../schemas/timeline.schema';
import { MaterialWarningsSchema, hasMaterialWarnings } from './material-review';
import type { MaterialWarnings } from './material-review';

export const PRODUCTION_PROPOSAL_VERSION = 1;
export const PRODUCTION_PROPOSAL_STATUSES = ['pending', 'approved'] as const;
export const PROPOSAL_MUSIC_MODES = ['bed', 'segments'] as const;
export const MIN_PROPOSAL_CONCEPTS = 2;
export const MAX_PROPOSAL_CONCEPTS = 3;
export const MAX_PROPOSAL_DURATION_SEC = 900;
export const MAX_PROPOSAL_SCENES = 60;

const ConceptIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/u, 'concept ids are lowercase letters, digits and dashes, at most 40 characters');

export const ProposalConceptSchema = z.strictObject({
  id: ConceptIdSchema,
  title: z.string().trim().min(1).max(120),
  angle: z.string().trim().min(1).max(600).describe('The creative approach in one or two sentences.'),
  format: OutputPresetSchema,
  durationSec: z.number().positive().max(MAX_PROPOSAL_DURATION_SEC),
  scenes: z.number().int().min(1).max(MAX_PROPOSAL_SCENES),
  delivery: DeliveryContractSchema,
  voiceId: z.string().min(1).optional(),
  musicMode: z.enum(PROPOSAL_MUSIC_MODES).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
});

export const ProductionProposalDraftSchema = z
  .strictObject({
    recommendedId: ConceptIdSchema,
    concepts: z.array(ProposalConceptSchema).min(MIN_PROPOSAL_CONCEPTS).max(MAX_PROPOSAL_CONCEPTS),
  })
  .superRefine((draft, ctx) => {
    const ids = draft.concepts.map((concept) => concept.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['concepts'], message: 'concept ids must be unique' });
    }
    if (!ids.includes(draft.recommendedId)) {
      ctx.addIssue({ code: 'custom', path: ['recommendedId'], message: 'recommendedId must be one of the concept ids' });
    }
  });

export const ProductionProposalSchema = z
  .strictObject({
    version: z.literal(PRODUCTION_PROPOSAL_VERSION),
    status: z.enum(PRODUCTION_PROPOSAL_STATUSES),
    approvedConceptId: ConceptIdSchema.optional(),
    approvedAt: z.iso.datetime().optional(),
    recommendedId: ConceptIdSchema,
    concepts: z.array(ProposalConceptSchema).min(MIN_PROPOSAL_CONCEPTS).max(MAX_PROPOSAL_CONCEPTS),
    materialWarnings: MaterialWarningsSchema.optional(),
  })
  .superRefine((proposal, ctx) => {
    const ids = proposal.concepts.map((concept) => concept.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['concepts'], message: 'concept ids must be unique' });
    }
    if (!ids.includes(proposal.recommendedId)) {
      ctx.addIssue({ code: 'custom', path: ['recommendedId'], message: 'recommendedId must be one of the concept ids' });
    }
    if (proposal.status === 'pending') {
      if (proposal.approvedConceptId !== undefined || proposal.approvedAt !== undefined) {
        ctx.addIssue({ code: 'custom', path: ['status'], message: 'a pending proposal carries no approval' });
      }
      return;
    }
    if (proposal.approvedConceptId === undefined || !ids.includes(proposal.approvedConceptId)) {
      ctx.addIssue({ code: 'custom', path: ['approvedConceptId'], message: 'an approved proposal names one of its concepts' });
    }
    if (proposal.approvedAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['approvedAt'], message: 'an approved proposal records when it was approved' });
    }
  });

export type ProposalConcept = z.infer<typeof ProposalConceptSchema>;
export type ProductionProposalDraft = z.infer<typeof ProductionProposalDraftSchema>;
export type ProductionProposal = z.infer<typeof ProductionProposalSchema>;
export type ProductionProposalStatus = (typeof PRODUCTION_PROPOSAL_STATUSES)[number];

export function pendingProposalFrom(draft: ProductionProposalDraft, warnings?: MaterialWarnings): ProductionProposal {
  return {
    version: PRODUCTION_PROPOSAL_VERSION,
    status: 'pending',
    recommendedId: draft.recommendedId,
    concepts: draft.concepts,
    ...(warnings === undefined || !hasMaterialWarnings(warnings) ? {} : { materialWarnings: warnings }),
  };
}

export function approveProposalConcept(
  proposal: ProductionProposal,
  conceptId: string,
  approvedAt: string,
): ProductionProposal | null {
  if (!proposal.concepts.some((concept) => concept.id === conceptId)) {
    return null;
  }
  return { ...proposal, status: 'approved', approvedConceptId: conceptId, approvedAt };
}
