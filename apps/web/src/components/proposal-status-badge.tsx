import { StateBadge } from '@e-burgos/tucu-ui';
import type { ProductionProposal } from '@video-maker/timeline-core';

import { useT } from '../i18n/language-context';

export type ProposalStatusBadgeProps = {
  proposal: ProductionProposal | null;
};

export function ProposalStatusBadge({ proposal }: ProposalStatusBadgeProps) {
  const t = useT();

  if (proposal === null) {
    return null;
  }

  const approved = proposal.status === 'approved';

  return (
    <StateBadge data-testid="proposal-status" data-status={proposal.status} tone={approved ? 'green' : 'orange'} dot>
      {approved ? t('proposal.statusApproved') : t('proposal.statusPending')}
    </StateBadge>
  );
}
