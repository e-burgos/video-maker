import { describe, expect, it } from 'vitest';

import { producerTurn } from './__fixtures__/producer';
import {
  PRODUCER_TURN_POLL_INTERVAL_MS,
  PRODUCER_TURN_POLL_TRANSPORT_RETRY_LIMIT,
  nextProducerTurnPollPlan,
} from './producer-turn-poll-plan';
import { RenderApiError } from './render-api-error';

function apiError(code: string): RenderApiError {
  return new RenderApiError(code, 'boom', 500, null);
}

describe('nextProducerTurnPollPlan', () => {
  it('polls a producer turn slower than a job: the turn lasts minutes, not seconds', () => {
    expect(PRODUCER_TURN_POLL_INTERVAL_MS).toBe(2500);
  });

  it('keeps polling while the turn is running', () => {
    expect(nextProducerTurnPollPlan({ kind: 'turn', turn: producerTurn() }, 0)).toEqual({
      keepPolling: true,
    });
  });

  it.each(['succeeded', 'failed', 'canceled'] as const)('stops on %s', (status) => {
    expect(nextProducerTurnPollPlan({ kind: 'turn', turn: producerTurn({ status }) }, 0)).toEqual({
      keepPolling: false,
      reason: 'terminal',
    });
  });

  it('stops without retrying when the turn is gone from the in-memory registry', () => {
    expect(
      nextProducerTurnPollPlan({ kind: 'error', error: apiError('PRODUCER_TURN_NOT_FOUND') }, 0),
    ).toEqual({ keepPolling: false, reason: 'not-found' });
  });

  it('tolerates transport failures up to the retry limit and then gives up', () => {
    const outcome = { kind: 'error', error: apiError('SERVICE_UNREACHABLE') } as const;

    expect(nextProducerTurnPollPlan(outcome, 0)).toEqual({ keepPolling: true });
    expect(nextProducerTurnPollPlan(outcome, PRODUCER_TURN_POLL_TRANSPORT_RETRY_LIMIT - 1)).toEqual({
      keepPolling: false,
      reason: 'unreachable',
    });
  });

  it('stops on any other typed error', () => {
    expect(nextProducerTurnPollPlan({ kind: 'error', error: apiError('PROJECT_NOT_FOUND') }, 0)).toEqual(
      { keepPolling: false, reason: 'unreachable' },
    );
  });
});
