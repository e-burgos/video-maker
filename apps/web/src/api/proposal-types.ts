import type { ProductionProposal } from '@video-maker/timeline-core';

export const SAMPLE_SECONDS = 10;

export type SampleSpec = { seconds: number };

export type ProposalEstimateBasisSource = 'history-format' | 'history-mode' | 'history-studio' | 'default';

export type ProposalRenderBasis = {
  source: ProposalEstimateBasisSource;
  samples: number;
  processSecPerMediaSec: number;
  rough: boolean;
};

export type ProposalEstimate = {
  renderMinutes: number;
  voiceMinutes: number;
  producerTokens: { input: number; output: number } | null;
  usd: number | null;
  basis: {
    mode: string;
    render: ProposalRenderBasis;
    voice: unknown;
  };
};

export type ProposalEngine = {
  kind: 'claude-cli' | 'openrouter' | 'none';
  model: string | null;
};

export type ProposalDocument = {
  slug: string;
  path: string;
  proposal: ProductionProposal | null;
  estimates: Record<string, ProposalEstimate>;
  engine: ProposalEngine;
};
