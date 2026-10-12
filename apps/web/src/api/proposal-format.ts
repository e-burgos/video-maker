import type { ProposalEstimate } from './proposal-types';

export function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    return '< 1';
  }
  return `~${String(Math.round(minutes * 10) / 10)}`;
}

export function formatUsd(usd: number): string {
  return usd < 0.01 ? '< 0.01' : usd.toFixed(2);
}

export function formatTokenCount(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
}

export function estimateBasisSamples(estimate: ProposalEstimate): number | null {
  const { source, samples } = estimate.basis.render;
  return source === 'default' || samples <= 0 ? null : samples;
}

export function formatDurationSeconds(durationSec: number): string {
  if (durationSec < 60) {
    return `${Math.round(durationSec)} s`;
  }
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.round(durationSec % 60);
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}
