import { workPath } from '@video-maker/auto-montage';

export const PRODUCTION_PROPOSAL_FILE_NAME = 'proposal.json';

export function productionProposalPath(): string {
  return workPath('producer', PRODUCTION_PROPOSAL_FILE_NAME);
}
