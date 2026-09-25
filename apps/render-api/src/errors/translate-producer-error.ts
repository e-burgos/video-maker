import { PipelineStageError } from './pipeline-stage-error';
import type { ProducerTurnResult } from '../producer/producer-agent';

const PRODUCER_RESOURCE = 'producer-agent';

const UNAVAILABLE_HINT =
  'install the Claude Code CLI and sign it in, or set CLAUDE_CLI_PATH to its absolute path';
const RATE_LIMITED_HINT = 'the account plan limit was reached, wait for the window to reset and retry';
const TIMED_OUT_HINT = 'raise PRODUCER_TURN_TIMEOUT_MS or ask the producer for a smaller step';
const NO_ANSWER_HINT = 'run the same prompt manually with the CLI to see the provider error';
const OPENROUTER_KEY_MISSING_HINT = 'paste an OpenRouter API key in settings, or switch the producer engine to Claude';

export type ProducerTurnOutcome =
  | { readonly kind: 'succeeded' }
  | { readonly kind: 'canceled' }
  | { readonly kind: 'failed'; readonly error: PipelineStageError };

export interface ProducerTurnClassification {
  readonly result: ProducerTurnResult;
  readonly rateLimited: boolean;
  readonly hasAnswer: boolean;
}

export function producerUnavailable(cause?: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'PRODUCER_UNAVAILABLE',
    stage: null,
    resource: PRODUCER_RESOURCE,
    hint: UNAVAILABLE_HINT,
    ...(cause === undefined ? {} : { cause }),
  });
}

export function producerRateLimited(): PipelineStageError {
  return new PipelineStageError({
    code: 'PRODUCER_RATE_LIMITED',
    stage: null,
    resource: PRODUCER_RESOURCE,
    hint: RATE_LIMITED_HINT,
  });
}

export function producerTurnFailed(hint: string): PipelineStageError {
  return new PipelineStageError({
    code: 'PRODUCER_TURN_FAILED',
    stage: null,
    resource: PRODUCER_RESOURCE,
    hint,
  });
}

export function openRouterKeyMissing(): PipelineStageError {
  return new PipelineStageError({
    code: 'OPENROUTER_KEY_MISSING',
    stage: null,
    resource: PRODUCER_RESOURCE,
    hint: OPENROUTER_KEY_MISSING_HINT,
  });
}

export function classifyProducerTurn(input: ProducerTurnClassification): ProducerTurnOutcome {
  if (input.result.spawnFailed) {
    return { kind: 'failed', error: producerUnavailable() };
  }
  if (input.result.canceled) {
    return { kind: 'canceled' };
  }
  if (input.rateLimited) {
    return { kind: 'failed', error: producerRateLimited() };
  }
  if (input.result.timedOut) {
    return { kind: 'failed', error: producerTurnFailed(TIMED_OUT_HINT) };
  }
  if (!input.hasAnswer || input.result.exitCode !== 0) {
    return { kind: 'failed', error: producerTurnFailed(NO_ANSWER_HINT) };
  }
  return { kind: 'succeeded' };
}
