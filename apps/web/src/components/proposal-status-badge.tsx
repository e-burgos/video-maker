import type { ProductionProposal } from '@video-maker/timeline-core';

import { useT } from '../i18n/language-context';
import { Badge } from './ui/badge';

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
    <Badge data-testid="proposal-status" data-status={proposal.status} tone={approved ? 'success' : 'warning'}>
      {approved ? t('proposal.statusApproved') : t('proposal.statusPending')}
    </Badge>
  );
}
