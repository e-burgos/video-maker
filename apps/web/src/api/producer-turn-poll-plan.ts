import { isTerminalProducerTurnStatus } from './parse-producer';
import type { RenderApiError } from './render-api-error';
import type { ProducerTurn } from './render-api-types';

export const PRODUCER_TURN_POLL_INTERVAL_MS = 2500;
export const PRODUCER_TURN_POLL_TRANSPORT_RETRY_LIMIT = 3;

export type ProducerPollOutcome =
  | { kind: 'turn'; turn: ProducerTurn }
  | { kind: 'error'; error: RenderApiError };

export type ProducerPollStopReason = 'terminal' | 'not-found' | 'unreachable';

export type ProducerPollPlan =
  | { keepPolling: true }
  | { keepPolling: false; reason: ProducerPollStopReason };

export function nextProducerTurnPollPlan(
  outcome: ProducerPollOutcome,
  consecutiveTransportFailures: number,
): ProducerPollPlan {
  if (outcome.kind === 'turn') {
    return isTerminalProducerTurnStatus(outcome.turn.status)
      ? { keepPolling: false, reason: 'terminal' }
      : { keepPolling: true };
  }

  if (outcome.error.code === 'PRODUCER_TURN_NOT_FOUND') {
    return { keepPolling: false, reason: 'not-found' };
  }

  if (
    outcome.error.code === 'SERVICE_UNREACHABLE' &&
    consecutiveTransportFailures + 1 < PRODUCER_TURN_POLL_TRANSPORT_RETRY_LIMIT
  ) {
    return { keepPolling: true };
  }

  return { keepPolling: false, reason: 'unreachable' };
}
