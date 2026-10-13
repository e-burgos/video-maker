import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { YouTubeCategoryPlaylistsSection } from './youtube-category-playlists-section';
import type { RenderApiClient } from '../api/render-api-client';

function renderSection() {
  const client: Partial<RenderApiClient> = {
    getOrganization: vi.fn().mockResolvedValue({
      folders: [
        { id: 'f1', name: 'Tutorials', categories: [{ id: 'c1', name: 'Basics' }, { id: 'c2', name: 'Advanced' }] },
        { id: 'f2', name: 'Empty', categories: [] },
      ],
      videos: {},
    }),
    listYouTubePlaylists: vi.fn().mockResolvedValue([
      { id: 'PL1', title: 'List one' },
      { id: 'PL2', title: 'List two' },
    ]),
    getCategoryPlaylists: vi.fn().mockResolvedValue({ categoryPlaylists: { c1: 'PL1' }, generalPlaylistId: null }),
    putCategoryPlaylists: vi.fn().mockImplementation(async (input) => input),
  };
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <YouTubeCategoryPlaylistsSection />
    </RenderApiProvider>,
  );
  return client;
}

describe('YouTubeCategoryPlaylistsSection', () => {
  it('shows a select per category plus the general one and saves the mapping', async () => {
    const client = renderSection();

    await waitFor(() => expect(screen.getByLabelText('Tutorials › Basics')).toBeTruthy());
    expect((screen.getByLabelText('Tutorials › Basics') as HTMLSelectElement).value).toBe('PL1');
    expect((screen.getByLabelText('Tutorials › Advanced') as HTMLSelectElement).value).toBe('');

    fireEvent.change(screen.getByLabelText('Tutorials › Advanced'), { target: { value: 'PL2' } });
    fireEvent.change(screen.getByLabelText('Tutorials › Basics'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('General playlist'), { target: { value: 'PL1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save playlists' }));

    await waitFor(() =>
      expect(client.putCategoryPlaylists).toHaveBeenCalledWith({
        categoryPlaylists: { c1: null, c2: 'PL2' },
        generalPlaylistId: 'PL1',
      }),
    );
    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy());
  });
});
