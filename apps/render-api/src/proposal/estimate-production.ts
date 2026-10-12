import type { ProposalConcept } from '@video-maker/timeline-core';

export type ProductionMode = 'footage' | 'motion';

export const HISTORY_WINDOW = 20;
export const MIN_FORMAT_SAMPLES = 2;

export const DEFAULT_RENDER_PROCESS_SEC_PER_VIDEO_SEC: Readonly<Record<ProductionMode, number>> = {
  footage: 2,
  motion: 8,
};
export const DEFAULT_VOICE_PROCESS_SEC_PER_AUDIO_SEC = 0.9;

export const NARRATION_SHARE_OF_DURATION = 0.85;

export const DEFAULT_PRODUCER_TOKENS_BASE = { input: 250_000, output: 12_000 } as const;
export const DEFAULT_PRODUCER_TOKENS_PER_SCENE = { input: 6_000, output: 600 } as const;

const TOKENS_PER_MILLION = 1_000_000;
const SECONDS_PER_MINUTE = 60;

export interface HistorySample {
  readonly kind: 'render' | 'voice';
  readonly mode: ProductionMode | null;
  readonly format: string | null;
  readonly mediaSec: number;
  readonly processSec: number;
  readonly finishedAt: string;
}

export type ProducerEngineForEstimate =
  | { readonly kind: 'claude-cli' }
  | {
      readonly kind: 'openrouter';
      readonly model: string;
      readonly pricing: { readonly promptPerMTokUsd: number; readonly completionPerMTokUsd: number } | null;
    }
  | { readonly kind: 'none' };

export type EstimateSource = 'history-format' | 'history-mode' | 'default';

export interface RateBasis {
  readonly source: EstimateSource;
  readonly samples: number;
  readonly processSecPerMediaSec: number;
}

export interface ProductionEstimate {
  readonly renderMinutes: number;
  readonly voiceMinutes: number;
  readonly producerTokens: { readonly input: number; readonly output: number } | null;
  readonly usd: number | null;
  readonly basis: {
    readonly mode: ProductionMode;
    readonly render: RateBasis;
    readonly voice: RateBasis | null;
  };
}

export function productionModeOf(concept: ProposalConcept): ProductionMode {
  return concept.delivery.kind === 'motion' ? 'motion' : 'footage';
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function newestRatios(samples: readonly HistorySample[]): readonly number[] {
  return [...samples]
    .filter((sample) => sample.mediaSec > 0 && sample.processSec > 0)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .slice(0, HISTORY_WINDOW)
    .map((sample) => sample.processSec / sample.mediaSec);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function rateFrom(
  samples: readonly HistorySample[],
  format: string | null,
  fallback: number,
): RateBasis {
  const sameFormat = format === null ? [] : newestRatios(samples.filter((sample) => sample.format === format));
  if (sameFormat.length >= MIN_FORMAT_SAMPLES) {
    return { source: 'history-format', samples: sameFormat.length, processSecPerMediaSec: roundTo(median(sameFormat), 3) };
  }
  const sameMode = newestRatios(samples);
  if (sameMode.length > 0) {
    return { source: 'history-mode', samples: sameMode.length, processSecPerMediaSec: roundTo(median(sameMode), 3) };
  }
  return { source: 'default', samples: 0, processSecPerMediaSec: fallback };
}

function producerTokensFor(concept: ProposalConcept): { input: number; output: number } {
  return {
    input: DEFAULT_PRODUCER_TOKENS_BASE.input + concept.scenes * DEFAULT_PRODUCER_TOKENS_PER_SCENE.input,
    output: DEFAULT_PRODUCER_TOKENS_BASE.output + concept.scenes * DEFAULT_PRODUCER_TOKENS_PER_SCENE.output,
  };
}

function usdFor(
  tokens: { readonly input: number; readonly output: number },
  engine: Extract<ProducerEngineForEstimate, { kind: 'openrouter' }>,
): number | null {
  if (engine.pricing === null) {
    return null;
  }
  const usd =
    (tokens.input / TOKENS_PER_MILLION) * engine.pricing.promptPerMTokUsd +
    (tokens.output / TOKENS_PER_MILLION) * engine.pricing.completionPerMTokUsd;
  return roundTo(usd, 4);
}

export function estimateProduction(
  concept: ProposalConcept,
  history: readonly HistorySample[],
  producerEngine: ProducerEngineForEstimate,
): ProductionEstimate {
  const mode = productionModeOf(concept);

  const render = rateFrom(
    history.filter((sample) => sample.kind === 'render' && sample.mode === mode),
    mode === 'footage' ? concept.format : null,
    DEFAULT_RENDER_PROCESS_SEC_PER_VIDEO_SEC[mode],
  );
  const renderMinutes = roundTo((concept.durationSec * render.processSecPerMediaSec) / SECONDS_PER_MINUTE, 1);

  const voice =
    mode === 'motion' || concept.delivery.requiresVoice === false
      ? null
      : rateFrom(history.filter((sample) => sample.kind === 'voice'), null, DEFAULT_VOICE_PROCESS_SEC_PER_AUDIO_SEC);
  const voiceMinutes =
    voice === null
      ? 0
      : roundTo((concept.durationSec * NARRATION_SHARE_OF_DURATION * voice.processSecPerMediaSec) / SECONDS_PER_MINUTE, 1);

  const producerTokens = producerEngine.kind === 'openrouter' ? producerTokensFor(concept) : null;
  const usd = producerTokens !== null && producerEngine.kind === 'openrouter' ? usdFor(producerTokens, producerEngine) : null;

  return { renderMinutes, voiceMinutes, producerTokens, usd, basis: { mode, render, voice } };
}
