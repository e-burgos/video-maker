import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { PublicationsPanel } from './publications-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { Publication } from '../api/youtube-types';

function publication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    platform: 'youtube',
    file: 'out/video.mp4',
    title: 'My first video',
    videoId: 'abc123',
    url: 'https://youtu.be/abc123',
    privacy: 'public',
    status: 'published',
    publishAt: null,
    publishedAt: '2026-10-08T10:00:00.000Z',
    createdAt: '2026-10-08T09:55:00.000Z',
    ...overrides,
  };
}

function renderPanel(listPublications: RenderApiClient['listPublications']) {
  render(
    <RenderApiProvider client={{ listPublications } as RenderApiClient}>
      <PublicationsPanel slug="demo" refreshToken={0} />
    </RenderApiProvider>,
  );
}

describe('PublicationsPanel', () => {
  it('lists each publication with title, status badge and link', async () => {
    renderPanel(
      vi.fn().mockResolvedValue([
        publication(),
        publication({ id: 'pub-2', title: 'Later one', status: 'scheduled', publishAt: '2026-11-01T12:00:00.000Z' }),
        publication({ id: 'pub-3', title: 'Broken one', status: 'failed', url: null, videoId: null }),
      ]),
    );

    await waitFor(() => expect(screen.getAllByTestId('publication-row')).toHaveLength(3));
    const [published, scheduled, failed] = screen.getAllByTestId('publication-row');
    expect(within(published as HTMLElement).getByText('Published')).toBeTruthy();
    expect(within(published as HTMLElement).getByRole('link').getAttribute('href')).toBe('https://youtu.be/abc123');
    expect(within(scheduled as HTMLElement).getByText('Scheduled')).toBeTruthy();
    expect(within(failed as HTMLElement).getByText('Failed')).toBeTruthy();
    expect(within(failed as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('says so when nothing was published yet', async () => {
    renderPanel(vi.fn().mockResolvedValue([]));

    await waitFor(() => expect(screen.getByTestId('publications-empty')).toBeTruthy());
  });

  it('shows the error with its code', async () => {
    renderPanel(vi.fn().mockRejectedValue(new RenderApiError('PROJECT_NOT_FOUND', 'missing', 404, null)));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PROJECT_NOT_FOUND'));
  });
});
