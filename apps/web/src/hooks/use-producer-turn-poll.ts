import { useEffect, useRef, useState } from 'react';

import {
  PRODUCER_TURN_POLL_INTERVAL_MS,
  nextProducerTurnPollPlan,
} from '../api/producer-turn-poll-plan';
import type { ProducerPollStopReason } from '../api/producer-turn-poll-plan';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import type { ProducerTurn } from '../api/render-api-types';

export type ProducerTurnPoll = {
  turn: ProducerTurn | null;
  error: RenderApiError | null;
  polling: boolean;
  stopReason: ProducerPollStopReason | null;
};

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useProducerTurnPoll(
  turnId: string | null,
  load: (turnId: string) => Promise<ProducerTurn>,
): ProducerTurnPoll {
  const [turn, setTurn] = useState<ProducerTurn | null>(null);
  const [error, setError] = useState<RenderApiError | null>(null);
  const [polling, setPolling] = useState(false);
  const [stopReason, setStopReason] = useState<ProducerPollStopReason | null>(null);

  const loadRef = useRef(load);
  const requestSequence = useRef(0);
  const consecutiveTransportFailuresRef = useRef(0);

  loadRef.current = load;

  useEffect(() => {
    requestSequence.current += 1;
    const sequence = requestSequence.current;
    consecutiveTransportFailuresRef.current = 0;

    setTurn(null);
    setError(null);
    setStopReason(null);
    setPolling(turnId !== null);

    if (turnId === null) {
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = (currentTurnId: string): void => {
      loadRef
        .current(currentTurnId)
        .then((nextTurn) => {
          if (sequence !== requestSequence.current) {
            return;
          }

          consecutiveTransportFailuresRef.current = 0;
          setTurn(nextTurn);
          setError(null);

          const plan = nextProducerTurnPollPlan({ kind: 'turn', turn: nextTurn }, 0);
          if (plan.keepPolling) {
            timeoutId = setTimeout(() => tick(currentTurnId), PRODUCER_TURN_POLL_INTERVAL_MS);
            return;
          }

          setPolling(false);
          setStopReason(plan.reason);
        })
        .catch((cause: unknown) => {
          if (sequence !== requestSequence.current) {
            return;
          }

          const typed = toRenderApiError(cause);
          const plan = nextProducerTurnPollPlan(
            { kind: 'error', error: typed },
            consecutiveTransportFailuresRef.current,
          );

          setError(typed);

          if (plan.keepPolling) {
            consecutiveTransportFailuresRef.current += 1;
            timeoutId = setTimeout(() => tick(currentTurnId), PRODUCER_TURN_POLL_INTERVAL_MS);
            return;
          }

          setPolling(false);
          setStopReason(plan.reason);
        });
    };

    tick(turnId);

    return () => {
      requestSequence.current += 1;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [turnId]);

  return { turn, error, polling, stopReason };
}
