import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  producerConversation,
  producerSettings,
  producerTurn,
} from '../api/__fixtures__/producer';
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
});
