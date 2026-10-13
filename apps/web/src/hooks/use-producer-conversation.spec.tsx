import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  producerConversation,
  producerSettings,
  producerTurn,
  succeededTurn,
} from '../api/__fixtures__/producer';
import { materialReviewDocument } from '../api/__fixtures__/material-review';
import { RenderApiProvider } from '../api/render-api-context';
import { useProducerConversation } from './use-producer-conversation';
import type { RenderApiClient } from '../api/render-api-client';
import type { ServiceHealth } from '../api/render-api-types';

function health(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-10T00:00:00.000Z',
    engine: [],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

function clientWith(overrides: Partial<RenderApiClient>): RenderApiClient {
  return {
    getHealth: vi.fn().mockResolvedValue(health()),
    listAssets: vi.fn().mockResolvedValue({ slug: 'demo-01', source: 'catalog', assets: [], probeFailures: [] }),
    listRenderJobs: vi.fn().mockResolvedValue({ slug: 'demo-01', jobs: [] }),
    listGenerated: vi.fn().mockResolvedValue({ slug: 'demo-01', roots: [], files: [] }),
    getProducer: vi.fn().mockResolvedValue(producerConversation()),
    getMaterialReview: vi.fn().mockResolvedValue(materialReviewDocument(null)),
    getProducerSettings: vi.fn().mockResolvedValue(producerSettings()),
    sendProducerMessage: vi.fn(),
    cancelProducerTurn: vi.fn(),
    getProducerTurn: vi.fn(),
    ...overrides,
  } as unknown as RenderApiClient;
}

function wrapperWith(client: RenderApiClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RenderApiProvider client={client}>{children}</RenderApiProvider>;
  };
}

describe('useProducerConversation', () => {
  it('loads the conversation, assets, jobs and health of the given project', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useProducerConversation('demo-01'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.conversation.status).toBe('ready'));

    expect(result.current.conversation.data?.messages).toHaveLength(2);
    expect(client.listAssets).toHaveBeenCalledWith('demo-01');
    expect(client.listRenderJobs).toHaveBeenCalledWith('demo-01');
  });

  it('blocks sending when the render service health is unreachable', async () => {
    const client = clientWith({ getHealth: vi.fn().mockRejectedValue(new Error('down')) });
    const { result } = renderHook(() => useProducerConversation('demo-01'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.health.status).toBe('error'));

    expect(result.current.blockers.length).toBeGreaterThan(0);
  });

  it('defaults the model to the session model once the conversation loads', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useProducerConversation('demo-01'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.selectedModel).toBe('sonnet'));
  });

  it('sends the trimmed draft, clears it and adopts the returned turn id', async () => {
    const client = clientWith({
      sendProducerMessage: vi
        .fn()
        .mockResolvedValue({ slug: 'demo-01', turnId: 'turn-9001', startedAt: '2026-09-10T10:00:00.000Z', status: 'running' }),
      getProducerTurn: vi.fn().mockResolvedValue(producerTurn({ turnId: 'turn-9001' })),
    });
    const { result } = renderHook(() => useProducerConversation('demo-01'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.conversation.status).toBe('ready'));

    await act(async () => {
      await result.current.send('  hola productor  ');
    });

    expect(client.sendProducerMessage).toHaveBeenCalledWith('demo-01', 'hola productor', 'sonnet');
    expect(result.current.draft).toBe('');
    await waitFor(() => expect(result.current.poll.turn?.turnId).toBe('turn-9001'));
  });

  it('does nothing when asked to send only whitespace', async () => {
    const client = clientWith({});
    const { result } = renderHook(() => useProducerConversation('demo-01'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.conversation.status).toBe('ready'));

    await act(async () => {
      await result.current.send('   ');
    });

    expect(client.sendProducerMessage).not.toHaveBeenCalled();
  });

  describe('message queued while the producer works', () => {
    function workingClient() {
      let finished = false;
      const client = clientWith({
        sendProducerMessage: vi.fn().mockResolvedValue({
          slug: 'demo-01',
          turnId: 'turn-9001',
          startedAt: '2026-09-10T10:00:00.000Z',
          status: 'running',
        }),
        getProducerTurn: vi.fn(async () =>
          finished ? succeededTurn({ turnId: 'turn-9001' }) : producerTurn({ turnId: 'turn-9001' }),
        ),
      });
      return {
        client,
        finishTurn: () => {
          finished = true;
        },
      };
    }

    async function startWorkingTurn(client: RenderApiClient) {
      const rendered = renderHook(() => useProducerConversation('demo-01'), { wrapper: wrapperWith(client) });
      await waitFor(() => expect(rendered.result.current.conversation.status).toBe('ready'));
      act(() => rendered.result.current.submit('primero'));
      await waitFor(() => expect(rendered.result.current.running).toBe(true));
      return rendered;
    }

    it('holds a message submitted while running and sends it when the turn ends', async () => {
      const { client, finishTurn } = workingClient();
      const { result } = await startWorkingTurn(client);

      act(() => {
        result.current.setDraft('segundo');
        result.current.submit('segundo');
      });

      expect(result.current.queuedMessage).toEqual({ text: 'segundo', replaced: false });
      expect(result.current.draft).toBe('');
      expect(client.sendProducerMessage).toHaveBeenCalledTimes(1);

      finishTurn();

      await waitFor(() => expect(client.sendProducerMessage).toHaveBeenCalledTimes(2), { timeout: 8000 });
      expect(client.sendProducerMessage).toHaveBeenLastCalledWith('demo-01', 'segundo', 'sonnet');
      expect(result.current.queuedMessage).toBeNull();
    }, 12000);

    it('replaces the queued message on a second submit', async () => {
      const { client } = workingClient();
      const { result } = await startWorkingTurn(client);

      act(() => result.current.submit('segundo'));
      act(() => result.current.submit('tercero'));

      expect(result.current.queuedMessage).toEqual({ text: 'tercero', replaced: true });
    });

    it('drops the queued message when cancelled and never sends it', async () => {
      const { client, finishTurn } = workingClient();
      const { result } = await startWorkingTurn(client);

      act(() => result.current.submit('segundo'));
      act(() => result.current.cancelQueued());
      finishTurn();

      await waitFor(() => expect(result.current.running).toBe(false), { timeout: 8000 });
      expect(result.current.queuedMessage).toBeNull();
      expect(client.sendProducerMessage).toHaveBeenCalledTimes(1);
    }, 12000);
  });
});
