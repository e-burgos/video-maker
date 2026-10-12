import type { ProductionProposal } from '@video-maker/timeline-core';

import type { ProposalDocument, ProposalEstimate } from '../proposal-types';

export function productionProposal(overrides: Partial<ProductionProposal> = {}): ProductionProposal {
  return {
    version: 1,
    status: 'pending',
    recommendedId: 'directo',
    concepts: [
      {
        id: 'directo',
        title: 'Tutorial directo',
        angle: 'Pasos cortos con voz en off.',
        format: 'youtube-16x9',
        durationSec: 95,
        scenes: 6,
        delivery: { kind: 'tutorial' },
        musicMode: 'bed',
      },
      {
        id: 'reel',
        title: 'Reel vertical',
        angle: 'Un gancho y tres consejos.',
        format: 'reels-9x16',
        durationSec: 40,
        scenes: 1,
        delivery: { kind: 'short' },
      },
    ],
    ...overrides,
  };
}

export function proposalEstimate(overrides: Partial<ProposalEstimate> = {}): ProposalEstimate {
  return {
    renderMinutes: 4.26,
    voiceMinutes: 0.4,
    producerTokens: null,
    usd: null,
    basis: {
      mode: 'raw',
      render: { source: 'history-format', samples: 3, processSecPerMediaSec: 2.7 },
      voice: null,
    },
    ...overrides,
  };
}

export function proposalDocument(
  proposal: ProductionProposal | null,
  estimates: Record<string, ProposalEstimate> = {},
  slug = 'demo-01',
): ProposalDocument {
  return {
    slug,
    path: 'work/producer/proposal.json',
    proposal,
    estimates,
    engine: { kind: 'claude-cli', model: 'sonnet' },
  };
}
