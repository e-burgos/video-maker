import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { productionProposal } from '../api/__fixtures__/proposal';
import { ProposalStatusBadge } from './proposal-status-badge';

describe('ProposalStatusBadge', () => {
  it('renders nothing without a proposal', () => {
    render(<ProposalStatusBadge proposal={null} />);

    expect(screen.queryByTestId('proposal-status')).toBeNull();
  });

  it('shows the pending state', () => {
    render(<ProposalStatusBadge proposal={productionProposal()} />);

    expect(screen.getByText('Proposal pending')).toBeTruthy();
    expect(screen.getByTestId('proposal-status').getAttribute('data-status')).toBe('pending');
  });

  it('shows the approved state', () => {
    render(
      <ProposalStatusBadge
        proposal={productionProposal({ status: 'approved', approvedConceptId: 'directo', approvedAt: '2026-10-12T10:00:00.000Z' })}
      />,
    );

    expect(screen.getByText('Proposal approved')).toBeTruthy();
  });
});
