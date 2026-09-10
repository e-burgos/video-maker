import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  producerConversation,
  producerModels,
  producerTurn,
  succeededTurn,
} from '../api/__fixtures__/producer';
import { PRODUCER_TURN_POLL_INTERVAL_MS } from '../api/producer-turn-poll-plan';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { ProducerPage } from './producer-page';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetListing, ServiceHealth } from '../api/render-api-types';

function health(producer = true): ServiceHealth {
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
      producer,
    },
    jobs: { running: 0, queued: 0 },
  };
}

function assetListing(): AssetListing {
  return {
    slug: 'demo-01',
    source: 'catalog',
    assets: [
      {
        path: 'raw/aroll/clip01.mp4',
        role: 'aroll',
        fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
        media: null,
      },
    ],
    probeFailures: [],
  };
}

function renderPage(client: Partial<RenderApiClient>) {
  const withDefaults: Partial<RenderApiClient> = {
    getHealth: vi.fn().mockResolvedValue(health()),
    listAssets: vi.fn().mockResolvedValue(assetListing()),
    listRenderJobs: vi.fn().mockResolvedValue({ slug: 'demo-01', jobs: [] }),
    getProducer: vi.fn().mockResolvedValue(producerConversation()),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/demo-01/producer']}>
        <Routes>
          <Route path="/projects/:slug/producer" element={<ProducerPage />} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

function composer(): HTMLTextAreaElement {
  return screen.getByLabelText('Message for the producer') as HTMLTextAreaElement;
}

describe('ProducerPage', () => {
  it('welcomes a project that never talked to the producer with its real inventory', async () => {
    renderPage({
      getProducer: vi
        .fn()
        .mockResolvedValue({
          slug: 'demo-01',
          messages: [],
          session: null,
          activeTurn: null,
          models: producerModels(),
        }),
    });

    await waitFor(() => expect(screen.getByTestId('producer-welcome')).toBeTruthy());
    expect(screen.getByTestId('producer-inventory').textContent).toContain('aroll · 1');
    expect(screen.queryByTestId('producer-message-list')).toBeNull();
  });

  it('drops a starter into the composer without sending it', async () => {
    renderPage({
      getProducer: vi
        .fn()
        .mockResolvedValue({
          slug: 'demo-01',
          messages: [],
          session: null,
          activeTurn: null,
          models: producerModels(),
        }),
    });

    await waitFor(() => expect(screen.getByTestId('producer-starters')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Proponeme un guion con el material que subí' }));

    expect(composer().value).toBe('Proponeme un guion con el material que subí');
  });

  it('renders the stored conversation instead of the welcome', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    expect(screen.queryByTestId('producer-welcome')).toBeNull();
    expect(screen.getByTestId('producer-message-msg-0002').getAttribute('data-role')).toBe(
      'assistant',
    );
  });

  it('blocks the composer with the reason written when Claude Code is not available', async () => {
    renderPage({ getHealth: vi.fn().mockResolvedValue(health(false)) });

    await waitFor(() => expect(screen.getByTestId('producer-blockers')).toBeTruthy());
    expect(composer().disabled).toBe(true);
  });

  it('shows the typed failure of a conversation the service cannot read', async () => {
    renderPage({
      getProducer: vi
        .fn()
        .mockRejectedValue(new RenderApiError('PRODUCER_STATE_INVALID', 'cannot parse', 422, null)),
    });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PRODUCER_STATE_INVALID'));
  });

  it('explains a refusal of the send in the language of the user next to its code', async () => {
    renderPage({
      sendProducerMessage: vi
        .fn()
        .mockRejectedValue(new RenderApiError('PRODUCER_UNAVAILABLE', 'no claude', 503, null)),
    });

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    fireEvent.change(composer(), { target: { value: 'dale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(screen.getByTestId('producer-send-failure').textContent).toContain(
        'PRODUCER_UNAVAILABLE',
      ),
    );
    expect(screen.getByTestId('producer-send-failure').textContent).toContain('Claude Code is not installed');
  });

  it('starts on the model of the session and sends the one the user picks (FIX-e-burgos-015-001)', async () => {
    const sendProducerMessage = vi.fn().mockResolvedValue({
      slug: 'demo-01',
      turnId: 'turn-0004',
      startedAt: '2026-09-10T10:30:00.000Z',
      status: 'running',
    });
    renderPage({
      sendProducerMessage,
      getProducer: vi.fn().mockResolvedValue(
        producerConversation({
          session: {
            sessionId: 'session-0001',
            model: 'opus',
            createdAt: '2026-09-10T10:00:01.000Z',
            lastTurnAt: '2026-09-10T10:04:01.000Z',
          },
        }),
      ),
      getProducerTurn: vi.fn().mockResolvedValue(producerTurn({ turnId: 'turn-0004' })),
    });

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    const picker = screen.getByLabelText('model') as HTMLSelectElement;
    expect(picker.value).toBe('opus');

    fireEvent.change(picker, { target: { value: 'haiku' } });
    fireEvent.change(composer(), { target: { value: 'dale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(sendProducerMessage).toHaveBeenCalledWith('demo-01', 'dale', 'haiku'),
    );
  });

  it('falls back to the default of the service when the project has no session yet', async () => {
    renderPage({
      getProducer: vi.fn().mockResolvedValue(
        producerConversation({ session: null, models: producerModels({ default: 'haiku' }) }),
      ),
    });

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    expect((screen.getByLabelText('model') as HTMLSelectElement).value).toBe('haiku');
  });

  it('shows the model that produced each answer of the producer', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    expect(screen.getByTestId('producer-message-model-msg-0002').textContent).toBe('sonnet');
    expect(screen.queryByTestId('producer-message-model-msg-0001')).toBeNull();
  });

  it('adopts a turn that was already running when the page opened', async () => {
    const getProducerTurn = vi.fn().mockResolvedValue(producerTurn());
    renderPage({
      getProducer: vi.fn().mockResolvedValue(producerConversation({ activeTurn: producerTurn() })),
      getProducerTurn,
    });

    await waitFor(() => expect(screen.getByTestId('producer-turn-activity')).toBeTruthy());
    expect(getProducerTurn).toHaveBeenCalledWith('demo-01', 'turn-0001');
    expect(screen.getByTestId('producer-turn-events').textContent).toContain('ffprobe');
  });
});

describe('ProducerPage — a full turn', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the message, follows the turn and reloads the studio when it settles', async () => {
    const sendProducerMessage = vi.fn().mockResolvedValue({
      slug: 'demo-01',
      turnId: 'turn-0002',
      startedAt: '2026-09-10T10:00:00.000Z',
      status: 'running',
    });
    const getProducerTurn = vi
      .fn()
      .mockResolvedValueOnce(producerTurn({ turnId: 'turn-0002' }))
      .mockResolvedValue(succeededTurn({ turnId: 'turn-0002' }));
    const getProducer = vi.fn().mockResolvedValue(producerConversation());
    const listAssets = vi.fn().mockResolvedValue(assetListing());
    const listRenderJobs = vi.fn().mockResolvedValue({
      slug: 'demo-01',
      jobs: [
        {
          id: 'job-0007',
          kind: 'montage',
          state: 'running',
          stage: 'probe',
          errorCode: null,
          createdAt: '2026-09-10T10:00:05.000Z',
          startedAt: '2026-09-10T10:00:06.000Z',
          finishedAt: null,
        },
      ],
    });

    renderPage({ sendProducerMessage, getProducerTurn, getProducer, listAssets, listRenderJobs });

    await waitFor(() => expect(screen.getByTestId('producer-message-list')).toBeTruthy());
    const conversationLoads = getProducer.mock.calls.length;

    fireEvent.change(composer(), { target: { value: 'Proponeme un video de 30 segundos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(sendProducerMessage).toHaveBeenCalledWith(
        'demo-01',
        'Proponeme un video de 30 segundos',
        'sonnet',
      ),
    );
    await waitFor(() => expect(composer().value).toBe(''));
    await waitFor(() => expect(screen.getByTestId('producer-turn-activity')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('producer-jobs').textContent).toContain('montage'));

    await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);

    await waitFor(() =>
      expect(screen.getByTestId('producer-turn-activity').getAttribute('data-status')).toBe(
        'succeeded',
      ),
    );
    await waitFor(() => expect(getProducer.mock.calls.length).toBeGreaterThan(conversationLoads + 1));
    expect(listAssets.mock.calls.length).toBeGreaterThan(1);
  });

  it('cancels the running turn and keeps polling until it is really canceled', async () => {
    const cancelProducerTurn = vi.fn().mockResolvedValue(producerTurn());
    const getProducerTurn = vi
      .fn()
      .mockResolvedValueOnce(producerTurn())
      .mockResolvedValue(producerTurn({ status: 'canceled', finishedAt: '2026-09-10T10:01:00.000Z' }));

    renderPage({
      getProducer: vi.fn().mockResolvedValue(producerConversation({ activeTurn: producerTurn() })),
      getProducerTurn,
      cancelProducerTurn,
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(cancelProducerTurn).toHaveBeenCalledWith('demo-01', 'turn-0001'));

    await vi.advanceTimersByTimeAsync(PRODUCER_TURN_POLL_INTERVAL_MS);

    await waitFor(() =>
      expect(screen.getByTestId('producer-turn-activity').getAttribute('data-status')).toBe(
        'canceled',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('answers with a chip and starts a second turn with that exact text', async () => {
    const sendProducerMessage = vi.fn().mockResolvedValue({
      slug: 'demo-01',
      turnId: 'turn-0003',
      startedAt: '2026-09-10T10:20:00.000Z',
      status: 'running',
    });

    renderPage({
      sendProducerMessage,
      getProducerTurn: vi.fn().mockResolvedValue(producerTurn({ turnId: 'turn-0003' })),
    });

    await waitFor(() => expect(screen.getByTestId('producer-suggestions')).toBeTruthy());
    fireEvent.click(
      screen.getByRole('button', { name: 'Dale, avanzá con el corte de 30 segundos' }),
    );

    await waitFor(() =>
      expect(sendProducerMessage).toHaveBeenCalledWith(
        'demo-01',
        'Dale, avanzá con el corte de 30 segundos',
        'sonnet',
      ),
    );
  });
});
