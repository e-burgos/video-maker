import { describe, expect, it } from 'vitest';

import {
  estimateBasisSamples,
  formatDurationSeconds,
  formatMinutes,
  formatTokenCount,
  formatUsd,
} from './proposal-format';
import type { ProposalEstimate } from './proposal-types';

function estimateWith(source: ProposalEstimate['basis']['render']['source'], samples: number): ProposalEstimate {
  return {
    renderMinutes: 4,
    voiceMinutes: 1,
    producerTokens: null,
    usd: null,
    basis: { mode: 'raw', render: { source, samples, processSecPerMediaSec: 3 }, voice: null },
  };
}

describe('proposal format', () => {
  it('rounds minutes to one decimal and floors tiny values', () => {
    expect(formatMinutes(4.26)).toBe('~4.3');
    expect(formatMinutes(0.3)).toBe('< 1');
  });

  it('formats usd and token counts', () => {
    expect(formatUsd(0.0042)).toBe('< 0.01');
    expect(formatUsd(1.234)).toBe('1.23');
    expect(formatTokenCount(850)).toBe('850');
    expect(formatTokenCount(12_345)).toBe('12.3k');
  });

  it('formats durations in seconds and minutes', () => {
    expect(formatDurationSeconds(45)).toBe('45 s');
    expect(formatDurationSeconds(120)).toBe('2 min');
    expect(formatDurationSeconds(95)).toBe('1 min 35 s');
  });

  it('reports render samples only when the estimate comes from history', () => {
    expect(estimateBasisSamples(estimateWith('history-format', 5))).toBe(5);
    expect(estimateBasisSamples(estimateWith('default', 0))).toBeNull();
  });
});
