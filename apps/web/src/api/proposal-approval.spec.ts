import { describe, expect, it } from 'vitest';

import { productionProposal } from './__fixtures__/proposal';
import { recommendedConceptToApprove } from './proposal-approval';

describe('recommendedConceptToApprove', () => {
  it('has nothing to approve without a proposal', () => {
    expect(recommendedConceptToApprove(null)).toBeNull();
  });

  it('returns the recommended concept of a pending proposal', () => {
    const proposal = productionProposal();

    expect(recommendedConceptToApprove(proposal)).toBe(proposal.recommendedId);
  });

  it('returns nothing once the proposal is approved', () => {
    const proposal = productionProposal({ status: 'approved', approvedConceptId: productionProposal().recommendedId });

    expect(recommendedConceptToApprove(proposal)).toBeNull();
  });
});
