import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { publishQueue, queueItem } from '../api/__fixtures__/publish-queue';
import { RenderApiProvider } from '../api/render-api-context';
import { ShellToolbar } from '../components/shell/shell-toolbar';
import { ToolbarActionProvider } from '../components/shell/toolbar-action-provider';
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
      <ToolbarActionProvider>
        <MemoryRouter>
          <ShellToolbar title="Publishing" subtitle={null} />
          <PublishQueuePage />
        </MemoryRouter>
      </ToolbarActionProvider>
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

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(4));
    expect(screen.getByTestId('publish-queue-state').textContent).toBe('Active');
    expect(screen.getByTestId('publish-queue-stat-last24h').textContent).toBe('3 / 10last 24 h');
    expect(screen.getByTestId('publish-queue-stat-queued').textContent).toBe('3in queue');
    expect(screen.getByTestId('publish-queue-stat-failed').textContent).toBe('1with errors');
    expect(screen.getByTestId('publish-queue-next-attempt').textContent).toContain('Next attempt at');
    expect(within(rowOf('First')).getByText('Queued')).toBeTruthy();
    expect(within(rowOf('Second')).getByText(/^retries at \d\d:\d\d$/u)).toBeTruthy();
    expect(within(rowOf('Third')).getByText('Publishing')).toBeTruthy();
    expect(within(rowOf('Sixth')).getByText('upload exploded')).toBeTruthy();
    expect(within(rowOf('Sixth')).getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(within(rowOf('First')).queryByRole('button', { name: 'Retry' })).toBeNull();

    fireEvent.click(screen.getByTestId('publish-queue-filter-published'));
    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(2));
    expect(within(rowOf('Fourth')).getByText('Published')).toBeTruthy();
    expect(within(rowOf('Fourth')).getByRole('link', { name: 'Open on YouTube' }).getAttribute('href')).toBe(
      'https://youtu.be/pub',
    );
    expect(within(rowOf('Fifth')).getByText('Already published')).toBeTruthy();
    expect(within(rowOf('Fifth')).getByRole('link', { name: 'Open on YouTube' }).getAttribute('href')).toBe(
      'https://youtu.be/dup',
    );
  });

  it('pauses and resumes the queue', async () => {
    const client = renderPage(publishQueue([queueItem()]));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(client.updatePublishQueueSettings).toHaveBeenCalledWith({ paused: true }));
  });

  it('declares pause as the toolbar action and shows the queue state next to it', async () => {
    renderPage(publishQueue([queueItem()]));

    await waitFor(() => expect(screen.getByTestId('toolbar-action').textContent).toBe('Pause'));
    expect(within(screen.getByTestId('shell-toolbar')).getByTestId('publish-queue-state').textContent).toBe('Active');
    expect(screen.getAllByRole('button', { name: 'Pause' })).toHaveLength(1);
  });

  it('keeps the removal inside the row menu', async () => {
    renderPage(publishQueue([queueItem()]));

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(1));
    expect(within(rowOf('Demo title')).queryByRole('button', { name: 'Remove' })).toBeNull();
    fireEvent.click(within(rowOf('Demo title')).getByTestId('publish-queue-menu'));

    expect(screen.getByTestId('publish-queue-menu-list')).toBeTruthy();
  });

  it('tells an empty filter apart from an empty queue', async () => {
    renderPage(publishQueue([queueItem()]));

    await waitFor(() => expect(screen.getAllByTestId('publish-queue-row')).toHaveLength(1));
    fireEvent.click(screen.getByTestId('publish-queue-filter-published'));

    expect(screen.getByTestId('publish-queue-empty-filter')).toBeTruthy();
    expect(screen.queryByTestId('publish-queue-empty')).toBeNull();
  });

  it('shows the thumbnail only on an opaque frame', async () => {
    renderPage(
      publishQueue([
        queueItem({
          metadata: { title: 'Covered', description: '', tags: [], privacy: 'public', thumbnail: 'assets/cover.png' },
        }),
      ]),
    );

    await waitFor(() => expect(screen.getByTestId('publish-queue-thumbnail')).toBeTruthy());
    expect(screen.getByTestId('publish-queue-thumbnail').className).toContain('bg-[#0b0d14]');
    expect(screen.getByAltText('Thumbnail of “Covered”').getAttribute('src')).toBe(
      '/api/projects/demo/files/assets/cover.png',
    );
  });

  it('offers Resume when paused and saves the daily limit', async () => {
    const client = renderPage(publishQueue([], { settings: { paused: true, dailyLimit: 10 } }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy());
    expect(screen.getByTestId('publish-queue-state').textContent).toBe('Paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(client.updatePublishQueueSettings).toHaveBeenCalledWith({ paused: false }));
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
    fireEvent.click(within(rowOf('Second')).getByTestId('publish-queue-menu'));
    fireEvent.click(screen.getByTestId('publish-queue-remove'));
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
