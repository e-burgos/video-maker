import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { publishQueue, queueItem } from '../api/__fixtures__/publish-queue';
import { RenderApiProvider } from '../api/render-api-context';
import { PublishQueuePage } from './publish-queue-page';
import type { RenderApiClient } from '../api/render-api-client';
import type { PublishQueue } from '../api/publish-queue-types';

function renderPage(queue: PublishQueue, overrides: Partial<RenderApiClient> = {}) {
  const client: Partial<RenderApiClient> = {
    getPublishQueue: vi.fn().mockResolvedValue(queue),
    updatePublishQueueSettings: vi.fn().mockResolvedValue(queue.settings),
    updatePublishQueueItem: vi.fn().mockResolvedValue(queueItem()),
    removePublishQueueItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <PublishQueuePage />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return client;
}

const ALL_STATES = [
  queueItem({ id: 'a', metadata: { title: 'First', description: '', tags: [], privacy: 'public' } }),
  queueItem({
    id: 'b',
    metadata: { title: 'Second', description: '', tags: [], privacy: 'public' },
    status: 'queued',
    nextAttemptAt: '2026-10-13T15:30:00.000Z',
  }),
  queueItem({ id: 'c', metadata: { title: 'Third', description: '', tags: [], privacy: 'public' }, status: 'publishing' }),
  queueItem({
    id: 'd',
    metadata: { title: 'Fourth', description: '', tags: [], privacy: 'public' },
    status: 'published',
    url: 'https://youtu.be/pub',
  }),
  queueItem({
    id: 'e',
    metadata: { title: 'Fifth', description: '', tags: [], privacy: 'public' },
    status: 'already-published',
    url: 'https://youtu.be/dup',
  }),
  queueItem({
    id: 'f',
    metadata: { title: 'Sixth', description: '', tags: [], privacy: 'public' },
    status: 'failed',
    lastError: { code: 'YOUTUBE_UPLOAD_FAILED', stage: null, message: 'upload exploded' },
  }),
];

function rowOf(title: string): HTMLElement {
  const row = screen.getAllByTestId('publish-queue-row').find((candidate) => candidate.textContent?.includes(title));
  if (row === undefined) {
    throw new Error(`no row for ${title}`);
  }
  return row;
}

describe('PublishQueuePage', () => {
  it('shows an empty state', async () => {
    renderPage(publishQueue([]));

    await waitFor(() => expect(screen.getByTestId('publish-queue-empty')).toBeTruthy());
  });

  it('lists every state with its chip, link and error', async () => {
    renderPage(publishQueue(ALL_STATES, { nextAttemptAt: '2026-10-13T15:30:00.000Z' }));

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(6));
    expect(screen.getByTestId('publish-queue-state').textContent).toBe('Active');
    expect(screen.getByText('Published in the last 24 h: 3 of 10')).toBeTruthy();
    expect(screen.getByTestId('publish-queue-next-attempt').textContent).toContain('Next attempt at');
    expect(within(rowOf('First')).getByText('Queued')).toBeTruthy();
    expect(within(rowOf('Second')).getByText(/^retries at \d\d:\d\d$/u)).toBeTruthy();
    expect(within(rowOf('Third')).getByText('Publishing')).toBeTruthy();
    expect(within(rowOf('Fourth')).getByText('Published')).toBeTruthy();
    expect(within(rowOf('Fourth')).getByRole('link', { name: 'Open on YouTube' }).getAttribute('href')).toBe(
      'https://youtu.be/pub',
    );
    expect(within(rowOf('Fifth')).getByText('Already published')).toBeTruthy();
    expect(within(rowOf('Fifth')).getByRole('link', { name: 'Open on YouTube' }).getAttribute('href')).toBe(
      'https://youtu.be/dup',
    );
    expect(within(rowOf('Sixth')).getByText('upload exploded')).toBeTruthy();
    expect(within(rowOf('Sixth')).getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(within(rowOf('First')).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('pauses and resumes the queue', async () => {
    const client = renderPage(publishQueue([queueItem()]));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(client.updatePublishQueueSettings).toHaveBeenCalledWith({ paused: true }));
  });

  it('offers Resume when paused and saves the daily limit', async () => {
    const client = renderPage(publishQueue([], { settings: { paused: true, dailyLimit: 10 } }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy());
    expect(screen.getByTestId('publish-queue-state').textContent).toBe('Paused');
    fireEvent.change(screen.getByLabelText('Daily limit'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save limit' }));

    await waitFor(() => expect(client.updatePublishQueueSettings).toHaveBeenCalledWith({ dailyLimit: 4 }));
  });

  it('moves an item to its neighbour position and disables the edges', async () => {
    const client = renderPage(publishQueue(ALL_STATES.slice(0, 2)));

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(2));
    expect((within(rowOf('First')).getByRole('button', { name: 'Move up' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(rowOf('First')).getByRole('button', { name: 'Move down' }));

    await waitFor(() => expect(client.updatePublishQueueItem).toHaveBeenCalledWith('a', { position: 1 }));
  });

  it('retries a failed item', async () => {
    const client = renderPage(publishQueue([ALL_STATES[5] as (typeof ALL_STATES)[number]]));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(client.updatePublishQueueItem).toHaveBeenCalledWith('f', { status: 'queued' }));
  });

  it('removes an item only after confirming', async () => {
    const client = renderPage(publishQueue(ALL_STATES.slice(0, 2)));

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(2));
    fireEvent.click(within(rowOf('Second')).getByRole('button', { name: 'Remove' }));
    expect(client.removePublishQueueItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('publish-queue-remove-accept'));

    await waitFor(() => expect(client.removePublishQueueItem).toHaveBeenCalledWith('b'));
  });

  it('refreshes the queue every 10 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = renderPage(publishQueue([]));

    await waitFor(() => expect(client.getPublishQueue).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(10_000);

    await waitFor(() => expect(client.getPublishQueue).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });
});
