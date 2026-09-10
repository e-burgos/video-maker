import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { producerTurn, succeededTurn } from '../api/__fixtures__/producer';
import { PRODUCER_TURN_POLL_INTERVAL_MS } from '../api/producer-turn-poll-plan';
import { RenderApiError } from '../api/render-api-error';
import { useProducerTurnPoll } from './use-producer-turn-poll';
import type { ProducerTurn } from '../api/render-api-types';

type Load = (turnId: string) => Promise<ProducerTurn>;

describe('useProducerTurnPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while no turn is running', () => {
    const load = vi.fn<Load>();
    const { result } = renderHook(() => useProducerTurnPoll(null, load));

    expect(result.current.polling).toBe(false);
    expect(result.current.turn).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('re-arms the next tick only after the previous answer settles and stops on the terminal status', async () => {
    const load = vi
      .fn<Load>()
      .mockResolvedValueOnce(producerTurn({ events: [] }))
      .mockResolvedValueOnce(producerTurn())
      .mockResolvedValueOnce(succeededTurn());

    const { result } = renderHook(() => useProducerTurnPoll('turn-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.polling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.turn?.events).toHaveLength(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);
    });
    expect(result.current.turn?.status).toBe('succeeded');
    expect(result.current.polling).toBe(false);
    expect(result.current.stopReason).toBe('terminal');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS * 4);
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps polling a cancellation until the turn actually settles as canceled', async () => {
    const load = vi
      .fn<Load>()
      .mockResolvedValueOnce(producerTurn())
      .mockResolvedValueOnce(producerTurn({ status: 'canceled', finishedAt: '2026-09-10T10:01:00.000Z' }));

    const { result } = renderHook(() => useProducerTurnPoll('turn-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);
    });

    expect(result.current.turn?.status).toBe('canceled');
    expect(result.current.polling).toBe(false);
  });

  it('gives up without retrying when the turn is not in the registry any more', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValue(new RenderApiError('PRODUCER_TURN_NOT_FOUND', 'gone', 404, null));

    const { result } = renderHook(() => useProducerTurnPoll('turn-0001', load));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.stopReason).toBe('not-found');
    expect(result.current.polling).toBe(false);
    expect(result.current.error?.code).toBe('PRODUCER_TURN_NOT_FOUND');
  });

  it('survives a transport hiccup and recovers the turn on the next tick', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(succeededTurn());

    const { result } = renderHook(() => useProducerTurnPoll('turn-0001', load));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error?.code).toBe('SERVICE_UNREACHABLE');
    expect(result.current.polling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.turn?.status).toBe('succeeded');
  });

  it('drops the answers of the previous turn when the page starts another one', async () => {
    const load = vi.fn<Load>().mockResolvedValue(succeededTurn());
    const { result, rerender } = renderHook(
      ({ turnId }: { turnId: string | null }) => useProducerTurnPoll(turnId, load),
      { initialProps: { turnId: 'turn-0001' as string | null } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.turn?.turnId).toBe('turn-0001');

    rerender({ turnId: null });
    expect(result.current.turn).toBeNull();
    expect(result.current.polling).toBe(false);
  });
});
