import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { AsyncResource } from '../hooks/use-async-resource';
import type { UseProducerConversationResult } from '../hooks/use-producer-conversation';
import { ProducerConversationPanel } from './producer-conversation-panel';

function readyResource<T>(data: T): AsyncResource<T> {
  return { status: 'ready', data, error: null, isRefreshing: false, reload: vi.fn() };
}

function loadingResource<T>(): AsyncResource<T> {
  return { status: 'loading', data: null, error: null, isRefreshing: false, reload: vi.fn() };
}

function fakeProducer(overrides: Partial<UseProducerConversationResult> = {}): UseProducerConversationResult {
  return {
    slug: 'demo-01',
    conversation: readyResource({
      slug: 'demo-01',
      messages: [],
      models: { default: 'sonnet', allowed: [] },
      session: null,
      activeTurn: null,
    }) as never,
    assets: readyResource({ slug: 'demo-01', source: 'catalog', assets: [], probeFailures: [] }),
    health: loadingResource(),
    jobs: readyResource({ slug: 'demo-01', jobs: [] }),
    generated: readyResource({ slug: 'demo-01', roots: [], files: [] }),
    hasTimedScript: false,
    draft: '',
    setDraft: vi.fn(),
    selectedModel: 'sonnet',
    setModel: vi.fn(),
    models: [],
    effectiveEngine: null,
    blockers: [],
    running: false,
    send: vi.fn(async () => undefined),
    sendPending: false,
    sendFailure: null,
    sendFailureKey: null,
    cancel: vi.fn(async () => undefined),
    cancelPending: false,
    cancelFailure: null,
    poll: { turn: null, error: null, polling: false, stopReason: null },
    ...overrides,
  };
}

describe('ProducerConversationPanel', () => {
  it('shows the welcome and the drop-zone seam when there is no conversation yet', () => {
    render(
      <MemoryRouter>
        <ProducerConversationPanel producer={fakeProducer()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('producer-welcome')).toBeTruthy();
    expect(screen.getByTestId('chat-drop-zone')).toBeTruthy();
    expect(screen.getByTestId('producer-composer')).toBeTruthy();
  });

  it('shows the message list instead of the welcome once there is a conversation', () => {
    const producer = fakeProducer({
      conversation: readyResource({
        slug: 'demo-01',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            text: 'hola',
            createdAt: '2026-09-10T00:00:00.000Z',
          },
        ],
        models: { default: 'sonnet', allowed: [] },
        session: null,
        activeTurn: null,
      }) as never,
    });

    render(
      <MemoryRouter>
        <ProducerConversationPanel producer={producer} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('producer-message-list')).toBeTruthy();
    expect(screen.queryByTestId('producer-welcome')).toBeNull();
  });

  it('sends the draft when the composer send action fires', () => {
    const send = vi.fn(async () => undefined);
    const producer = fakeProducer({ draft: 'hola productor', send });

    render(
      <MemoryRouter>
        <ProducerConversationPanel producer={producer} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Send'));

    expect(send).toHaveBeenCalledWith('hola productor');
  });

  it('surfaces a failed send with its explanation key', () => {
    const producer = fakeProducer({
      sendFailure: { code: 'PRODUCER_UNAVAILABLE', message: 'nope', payload: null } as never,
      sendFailureKey: 'producerFailure.PRODUCER_UNAVAILABLE',
    });

    render(
      <MemoryRouter>
        <ProducerConversationPanel producer={producer} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('producer-send-failure')).toBeTruthy();
  });
});
