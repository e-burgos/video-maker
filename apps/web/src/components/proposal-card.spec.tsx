import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { proposalDocument, proposalEstimate, productionProposal } from '../api/__fixtures__/proposal';
import { RenderApiError } from '../api/render-api-error';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import type { ProposalDocument } from '../api/proposal-types';
import type { AsyncResource } from '../hooks/use-async-resource';
import { ProposalCard } from './proposal-card';

function resource(data: ProposalDocument | null): AsyncResource<ProposalDocument> {
  return { status: data === null ? 'loading' : 'ready', data, error: null, isRefreshing: false, reload: vi.fn() };
}

function renderCard(proposal: AsyncResource<ProposalDocument>, client: Partial<RenderApiClient> = {}) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <ProposalCard slug="demo-01" proposal={proposal} />
    </RenderApiProvider>,
  );
}

const estimates = {
  directo: proposalEstimate({
    producerTokens: { input: 12_000, output: 2_500 },
    usd: 0.31,
  }),
  reel: proposalEstimate({
    basis: { mode: 'raw', render: { source: 'default', samples: 0, processSecPerMediaSec: 3 }, voice: null },
  }),
};

describe('ProposalCard', () => {
  it('renders nothing while there is no proposal', () => {
    renderCard(resource(proposalDocument(null)));

    expect(screen.queryByTestId('proposal-card')).toBeNull();
  });

  it('shows every concept with its details and marks the recommended one', () => {
    renderCard(resource(proposalDocument(productionProposal(), estimates)));

    const concepts = screen.getAllByTestId('proposal-concept');
    expect(concepts).toHaveLength(2);

    const direct = within(concepts[0] as HTMLElement);
    expect(direct.getByRole('heading', { name: 'Tutorial directo' })).toBeTruthy();
    expect(direct.getByText('Pasos cortos con voz en off.')).toBeTruthy();
    expect(direct.getByText('1 min 35 s')).toBeTruthy();
    expect(direct.getByText('6 scenes')).toBeTruthy();
    expect(direct.getByText('Tutorial')).toBeTruthy();
    expect(direct.getByText('Continuous bed')).toBeTruthy();
    expect(direct.getByText('Recommended')).toBeTruthy();
    expect(within(concepts[1] as HTMLElement).queryByText('Recommended')).toBeNull();
  });

  it('shows minutes, tokens, usd and the history basis when the estimate has them', () => {
    renderCard(resource(proposalDocument(productionProposal(), estimates)));

    const direct = within(screen.getAllByTestId('proposal-estimate')[0] as HTMLElement);
    expect(direct.getByText('Render: ~4.3 min')).toBeTruthy();
    expect(direct.getByText('Voice: < 1 min')).toBeTruthy();
    expect(direct.getByText('Producer: 12.0k in / 2.5k out tokens')).toBeTruthy();
    expect(direct.getByText('Cost: US$ 0.31')).toBeTruthy();
    expect(direct.getByText('based on 3 renders')).toBeTruthy();
  });

  it('omits tokens and usd when absent and falls back to the default-estimate note', () => {
    renderCard(resource(proposalDocument(productionProposal(), estimates)));

    const reel = within(screen.getAllByTestId('proposal-estimate')[1] as HTMLElement);
    expect(reel.queryByText(/tokens/u)).toBeNull();
    expect(reel.queryByText(/US\$/u)).toBeNull();
    expect(reel.getByText('default estimate')).toBeTruthy();
  });

  it('says so when a concept has no estimate', () => {
    renderCard(resource(proposalDocument(productionProposal(), {})));

    expect(screen.getAllByText('No estimate available')).toHaveLength(2);
  });

  it('approves the chosen concept and reloads the proposal', async () => {
    const approved = proposalDocument(productionProposal({ status: 'approved', approvedConceptId: 'reel', approvedAt: '2026-10-12T10:00:00.000Z' }));
    const approveProposal = vi.fn().mockResolvedValue(approved);
    const proposal = resource(proposalDocument(productionProposal(), estimates));
    renderCard(proposal, { approveProposal });

    fireEvent.click(screen.getByRole('button', { name: /Approve this approach: Reel vertical/u }));

    await waitFor(() => expect(approveProposal).toHaveBeenCalledWith('demo-01', 'reel'));
    await waitFor(() => expect(proposal.reload).toHaveBeenCalled());
  });

  it('shows the approved state and hides the approve button of the approved concept', () => {
    const doc = proposalDocument(
      productionProposal({ status: 'approved', approvedConceptId: 'directo', approvedAt: '2026-10-12T10:00:00.000Z' }),
      estimates,
    );
    renderCard(resource(doc));

    const [first, second] = screen.getAllByTestId('proposal-concept') as [HTMLElement, HTMLElement];
    expect(first.getAttribute('data-approved')).toBe('true');
    expect(within(first).getByText('Approved')).toBeTruthy();
    expect(within(first).queryByRole('button')).toBeNull();
    expect(within(second).getByRole('button', { name: /Approve this approach/u })).toBeTruthy();
    expect(screen.getAllByText('Proposal approved').length).toBeGreaterThan(0);
  });

  it('surfaces an approve failure', async () => {
    const approveProposal = vi
      .fn()
      .mockRejectedValue(new RenderApiError('PROPOSAL_NOT_FOUND', 'no proposal', 404, null));
    renderCard(resource(proposalDocument(productionProposal(), estimates)), { approveProposal });

    fireEvent.click(screen.getAllByRole('button', { name: /Approve this approach/u })[0] as HTMLElement);

    expect(await screen.findByText(/PROPOSAL_NOT_FOUND/u)).toBeTruthy();
  });
});
