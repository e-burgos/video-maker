import type { ProductionProposal } from '@video-maker/timeline-core';

export function recommendedConceptToApprove(proposal: ProductionProposal | null): string | null {
  if (proposal === null || proposal.status === 'approved') {
    return null;
  }
  return proposal.concepts.some((concept) => concept.id === proposal.recommendedId) ? proposal.recommendedId : null;
}
