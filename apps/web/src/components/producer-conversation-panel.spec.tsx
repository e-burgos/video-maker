import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';
import type { AsyncResource } from '../hooks/use-async-resource';
import type { UseProducerConversationResult } from '../hooks/use-producer-conversation';
import { ProducerConversationPanel } from './producer-conversation-panel';
import type { InboxAsset } from '../api/render-api-types';

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

function inboxAsset(overrides: Partial<InboxAsset> = {}): InboxAsset {
  return {
    id: 'inbox-0001',
    fileName: 'clip01.mp4',
    path: 'raw/inbox/clip01.mp4',
    proposedRole: 'aroll',
    proposalReason: 'has-audio',
    probe: { kind: 'video', durationMs: 4000, hasAudio: true },
    status: 'pending',
    ...overrides,
  };
}

function renderPanel(
  producer: UseProducerConversationResult,
  options: { pinned?: boolean; client?: Partial<RenderApiClient> } = {},
) {
  const client = {
    listInbox: vi.fn().mockResolvedValue({ assets: [] }),
    confirmInboxAsset: vi.fn(),
    discardInboxAsset: vi.fn(),
    uploadToInbox: vi.fn(),
    ...options.client,
  } as unknown as RenderApiClient;

  render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <ProducerConversationPanel producer={producer} pinned={options.pinned} />
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return { client };
}

describe('ProducerConversationPanel', () => {
  it('shows the welcome and the drop-zone seam when there is no conversation yet', async () => {
    renderPanel(fakeProducer());

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

    renderPanel(producer);

    expect(screen.getByTestId('producer-message-list')).toBeTruthy();
    expect(screen.queryByTestId('producer-welcome')).toBeNull();
  });

  it('sends the draft when the composer send action fires', () => {
    const send = vi.fn(async () => undefined);
    const producer = fakeProducer({ draft: 'hola productor', send });

    renderPanel(producer);

    fireEvent.click(screen.getByText('Send'));

    expect(send).toHaveBeenCalledWith('hola productor');
  });

  it('puts a clicked suggestion in the composer and focuses it without sending', () => {
    const send = vi.fn(async () => undefined);
    const setDraft = vi.fn();
    const producer = fakeProducer({
      send,
      setDraft,
      conversation: readyResource({
        slug: 'demo-01',
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            text: 'Listo.',
            suggestions: ['Dale, avanzá'],
            createdAt: '2026-09-10T00:00:00.000Z',
          },
        ],
        models: { default: 'sonnet', allowed: [] },
        session: null,
        activeTurn: null,
      }) as never,
    });

    renderPanel(producer);

    fireEvent.click(screen.getByRole('button', { name: 'Dale, avanzá' }));

    expect(setDraft).toHaveBeenCalledWith('Dale, avanzá');
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Message for the producer'));
  });

  it('pins the composer to the bottom of a full-height column when pinned is set', () => {
    renderPanel(fakeProducer(), { pinned: true });

    expect(screen.getByTestId('producer-conversation-panel').className).toContain('h-full');
    expect(screen.getByTestId('producer-composer').closest('[class*="shrink-0"]')).toBeTruthy();
  });

  it('lets the whole column flow and scroll normally when not pinned', () => {
    renderPanel(fakeProducer());

    expect(screen.getByTestId('producer-conversation-panel').className).not.toContain('h-full');
  });

  it('surfaces a failed send with its explanation key', () => {
    const producer = fakeProducer({
      sendFailure: { code: 'PRODUCER_UNAVAILABLE', message: 'nope', payload: null } as never,
      sendFailureKey: 'producerFailure.PRODUCER_UNAVAILABLE',
    });

    renderPanel(producer);

    expect(screen.getByTestId('producer-send-failure')).toBeTruthy();
  });

  it('shows a drop overlay while a file is dragged over the whole column, and hides it after drop', () => {
    renderPanel(fakeProducer());

    const panel = screen.getByTestId('producer-conversation-panel');
    fireEvent.dragEnter(panel, { dataTransfer: { types: ['Files'] } });

    expect(screen.getByTestId('chat-drop-overlay').textContent).toBe('Drop to add to the project');

    fireEvent.drop(panel, { dataTransfer: { types: ['Files'], files: [] } });

    expect(screen.queryByTestId('chat-drop-overlay')).toBeNull();
  });

  it('lists the pending inbox assets as proposal cards, persisted from GET inbox', async () => {
    renderPanel(fakeProducer(), {
      client: { listInbox: vi.fn().mockResolvedValue({ assets: [inboxAsset()] }) },
    });

    await waitFor(() => expect(screen.getByTestId('asset-proposal-list')).toBeTruthy());
    expect(screen.getByText('clip01.mp4')).toBeTruthy();
  });

  it('reloads the material listing after a proposal card is confirmed', async () => {
    const reloadAssets = vi.fn();
    const producer = fakeProducer({
      assets: {
        status: 'ready',
        data: { slug: 'demo-01', source: 'catalog', assets: [], probeFailures: [] },
        error: null,
        isRefreshing: false,
        reload: reloadAssets,
      },
    });
    const confirmInboxAsset = vi.fn().mockResolvedValue(inboxAsset({ status: 'confirmed' }));

    renderPanel(producer, {
      client: {
        listInbox: vi.fn().mockResolvedValue({ assets: [inboxAsset()] }),
        confirmInboxAsset,
      },
    });

    await waitFor(() => expect(screen.getByTestId('asset-proposal-list')).toBeTruthy());
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(confirmInboxAsset).toHaveBeenCalledWith('demo-01', 'inbox-0001', 'aroll'));
    await waitFor(() => expect(reloadAssets).toHaveBeenCalled());
  });

  it('shows the proposal cards in a dedicated stack above the composer, never inside the long scroll area, with the welcome collapsed to one line', async () => {
    renderPanel(fakeProducer(), {
      pinned: true,
      client: { listInbox: vi.fn().mockResolvedValue({ assets: [inboxAsset()] }) },
    });

    const proposalList = await screen.findByTestId('asset-proposal-list');
    const scrollArea = screen.getByTestId('producer-conversation-panel').querySelector('.overflow-y-auto');

    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.contains(proposalList)).toBe(false);

    const welcome = screen.getByTestId('producer-welcome');
    expect(welcome.dataset['compact']).toBe('true');
    expect(screen.queryByTestId('producer-inventory')).toBeNull();
    expect(screen.queryByTestId('producer-starters')).toBeNull();
  });

  it('keeps the full welcome, with material and starters, when there is no pending card', () => {
    renderPanel(fakeProducer());

    const welcome = screen.getByTestId('producer-welcome');
    expect(welcome.dataset['compact']).toBeUndefined();
    expect(screen.getByTestId('producer-inventory')).toBeTruthy();
    expect(screen.getByTestId('producer-starters')).toBeTruthy();
  });

  it('discards a proposal card without touching the material listing', async () => {
    const discardInboxAsset = vi.fn().mockResolvedValue({
      slug: 'demo-01',
      deleted: { id: 'inbox-0001', path: 'raw/inbox/clip01.mp4' },
    });

    renderPanel(fakeProducer(), {
      client: {
        listInbox: vi.fn().mockResolvedValue({ assets: [inboxAsset()] }),
        discardInboxAsset,
      },
    });

    await waitFor(() => expect(screen.getByTestId('asset-proposal-list')).toBeTruthy());
    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => expect(discardInboxAsset).toHaveBeenCalledWith('demo-01', 'inbox-0001'));
  });

  it('drops files onto the whole column and forwards them to the inbox upload', async () => {
    const uploadToInbox = vi.fn().mockResolvedValue(inboxAsset());
    renderPanel(fakeProducer(), { client: { uploadToInbox } });

    const file = new File(['x'], 'clip01.mp4', { type: 'video/mp4' });
    fireEvent.drop(screen.getByTestId('producer-conversation-panel'), {
      dataTransfer: { types: ['Files'], files: [file] },
    });

    await waitFor(() =>
      expect(uploadToInbox).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'demo-01', filename: 'clip01.mp4' }),
      ),
    );
  });

  it('ignores a drag that carries no files', () => {
    renderPanel(fakeProducer());

    fireEvent.dragEnter(screen.getByTestId('producer-conversation-panel'), {
      dataTransfer: { types: ['text/plain'] },
    });

    expect(screen.queryByTestId('chat-drop-overlay')).toBeNull();
  });

  it('keeps the overlay open while dragging across nested children, closing only once every leave is accounted for', () => {
    renderPanel(fakeProducer());
    const panel = screen.getByTestId('producer-conversation-panel');

    fireEvent.dragEnter(panel, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragEnter(panel, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(panel, { dataTransfer: { types: ['Files'] } });

    expect(screen.getByTestId('chat-drop-overlay')).toBeTruthy();

    fireEvent.dragLeave(panel, { dataTransfer: { types: ['Files'] } });

    expect(screen.queryByTestId('chat-drop-overlay')).toBeNull();
  });

  it('shows an unsupported-file message for a rejected drop, and can dismiss it', async () => {
    renderPanel(fakeProducer());

    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getByTestId('producer-conversation-panel'), {
      dataTransfer: { types: ['Files'], files: [file] },
    });

    await waitFor(() => expect(screen.getByText('notes.txt is not a supported video, image or audio file')).toBeTruthy());

    fireEvent.click(screen.getByText('Dismiss'));

    expect(screen.queryByTestId('inbox-upload-list')).toBeNull();
  });
});
