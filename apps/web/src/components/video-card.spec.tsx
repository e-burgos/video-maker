import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { VideoCard } from './video-card';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { ProjectSummary, VideoFolder, VideoPlacement } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

const VIDEO: ProjectSummary = {
  slug: 'editar-campana',
  layout: { raw: true, catalog: true, timeline: false, edl: false, out: false },
};

const FOLDERS: VideoFolder[] = [
  { id: 'display-ads', name: 'Display Ads', categories: [{ id: 'campanas', name: 'Campañas' }] },
  { id: 'tutoriales', name: 'Tutoriales', categories: [] },
];

const UNPLACED: VideoPlacement = { folderId: null, categoryId: null, archived: false };

function renderCard(
  client: Partial<RenderApiClient>,
  placement: VideoPlacement = UNPLACED,
  onChanged = vi.fn(),
  video: ProjectSummary = VIDEO,
) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <VideoCard video={video} placement={placement} folders={FOLDERS} onChanged={onChanged} />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return onChanged;
}

function openMenu(): void {
  fireEvent.click(screen.getByTestId('video-card-menu-open'));
}

describe('VideoCard', () => {
  it('opens the video on its chat-first workspace', () => {
    renderCard({});

    expect(screen.getByRole('link', { name: /editar-campana/u }).getAttribute('href')).toBe(
      '/projects/editar-campana',
    );
  });

  it('keeps the menu closed until the three dots are pressed', () => {
    renderCard({});

    expect(screen.queryByTestId('video-card-menu')).toBeNull();
    openMenu();
    expect(screen.getByTestId('video-card-menu')).toBeTruthy();
  });

  it('offers assign, archive and delete, and nothing else', () => {
    renderCard({});
    openMenu();

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Assign to a folder',
      'Archive',
      'Delete permanently',
    ]);
  });

  it('offers to restore instead of archive when the video is already archived', () => {
    renderCard({}, { folderId: null, categoryId: null, archived: true });
    openMenu();

    expect(screen.getByTestId('video-card-menu-archive').textContent).toBe('Restore');
  });

  it('opens a modal for each option, never acting straight from the menu', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    expect(screen.getByTestId('assign-video-modal').getAttribute('role')).toBe('dialog');
    fireEvent.click(screen.getByTestId('assign-video-cancel'));

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-archive'));
    expect(screen.getByTestId('archive-video-modal').getAttribute('role')).toBe('dialog');
    fireEvent.click(screen.getByTestId('archive-video-cancel'));

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-delete'));
    expect(screen.getByTestId('delete-video-modal').getAttribute('role')).toBe('dialog');
  });

  it('closes the menu once an option is chosen', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));

    expect(screen.queryByTestId('video-card-menu')).toBeNull();
  });

  it('shows a humanized title above the raw slug', () => {
    renderCard({}, UNPLACED, vi.fn(), { slug: 'editar-campana', layout: VIDEO.layout });

    expect(screen.getByText('Editar campana')).toBeTruthy();
    expect(screen.getByText('editar-campana')).toBeTruthy();
  });

  it.each([
    [{ raw: false, catalog: false, timeline: false, edl: false, out: false }, 'No material'],
    [{ raw: true, catalog: false, timeline: false, edl: false, out: false }, 'Material loaded'],
    [{ raw: true, catalog: true, timeline: true, edl: false, out: false }, 'Cut ready'],
    [{ raw: true, catalog: true, timeline: true, edl: true, out: true }, 'Video ready'],
  ])('shows one status badge for the layout %j', (layout, label) => {
    renderCard({}, UNPLACED, vi.fn(), { slug: 'a-video', layout });

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('falls back to a placeholder icon when there is nothing to show a frame of', async () => {
    renderCard({
      listGenerated: vi.fn().mockResolvedValue({ slug: 'editar-campana', roots: [], files: [] }),
      listAssets: vi
        .fn()
        .mockResolvedValue({ slug: 'editar-campana', source: 'catalog', assets: [], probeFailures: [] }),
    });

    expect(
      await screen.findByTestId('video-card-thumbnail-placeholder'),
    ).toBeTruthy();
    expect(screen.queryByTestId('video-card-updated-at')).toBeNull();
  });

  it('shows the latest render as the thumbnail with its date, over a raw asset', async () => {
    renderCard({
      listGenerated: vi.fn().mockResolvedValue({
        slug: 'editar-campana',
        roots: ['out'],
        files: [{ path: 'out/final.mp4', sizeBytes: 10, modifiedAtMs: Date.UTC(2026, 8, 24, 12) }],
      }),
    });

    const thumbnail = (await screen.findByTestId('video-card-thumbnail')) as HTMLVideoElement;
    expect(thumbnail.src).toContain('/files/out/final.mp4');
    expect(thumbnail.src).toContain('#t=0.5');
    expect(screen.getByTestId('video-card-updated-at').textContent).toContain('24');
  });
});

describe('assign modal', () => {
  it('writes the folder and the category the user picked, and reports the change', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    const onChanged = renderCard({ putVideoPlacement });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.change(screen.getByTestId('assign-video-folder'), { target: { value: 'display-ads' } });
    fireEvent.change(screen.getByTestId('assign-video-category'), { target: { value: 'campanas' } });
    fireEvent.click(screen.getByTestId('assign-video-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
      folderId: 'display-ads',
      categoryId: 'campanas',
      archived: false,
    });
  });

  it('sends the video back to no project when the empty option is picked', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    renderCard({ putVideoPlacement }, { folderId: 'display-ads', categoryId: 'campanas', archived: false });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.change(screen.getByTestId('assign-video-folder'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('assign-video-submit'));

    await waitFor(() =>
      expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
        folderId: null,
        categoryId: null,
        archived: false,
      }),
    );
  });

  it('drops the stale category when the folder changes, so it never sends a mismatch', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    renderCard({ putVideoPlacement }, { folderId: 'display-ads', categoryId: 'campanas', archived: false });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.change(screen.getByTestId('assign-video-folder'), { target: { value: 'tutoriales' } });
    fireEvent.click(screen.getByTestId('assign-video-submit'));

    await waitFor(() =>
      expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
        folderId: 'tutoriales',
        categoryId: null,
        archived: false,
      }),
    );
  });

  it('keeps the archived flag untouched while only the folder moves', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    renderCard({ putVideoPlacement }, { folderId: null, categoryId: null, archived: true });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.change(screen.getByTestId('assign-video-folder'), { target: { value: 'tutoriales' } });
    fireEvent.click(screen.getByTestId('assign-video-submit'));

    await waitFor(() =>
      expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
        folderId: 'tutoriales',
        categoryId: null,
        archived: true,
      }),
    );
  });

  it('says where to create a category when the chosen folder has none', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.change(screen.getByTestId('assign-video-folder'), { target: { value: 'tutoriales' } });

    expect(screen.getByTestId('assign-video-no-categories')).toBeTruthy();
    expect((screen.getByTestId('assign-video-category') as HTMLSelectElement).disabled).toBe(true);
  });

  it('shows the typed service error and leaves the modal open', async () => {
    const putVideoPlacement = vi
      .fn()
      .mockRejectedValue(new RenderApiError('FOLDER_NOT_FOUND', 'gone', null, null));
    const onChanged = renderCard({ putVideoPlacement });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-assign'));
    fireEvent.click(screen.getByTestId('assign-video-submit'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('FOLDER_NOT_FOUND'));
    expect(screen.getByTestId('assign-video-modal')).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('archive modal', () => {
  it('archives without moving the video out of its folder', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    const onChanged = renderCard(
      { putVideoPlacement },
      { folderId: 'display-ads', categoryId: 'campanas', archived: false },
    );

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-archive'));
    fireEvent.click(screen.getByTestId('archive-video-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
      folderId: 'display-ads',
      categoryId: 'campanas',
      archived: true,
    });
  });

  it('promises that archiving deletes nothing', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-archive'));

    expect(screen.getByTestId('archive-video-modal').textContent).toContain('nothing is deleted');
  });

  it('restores an archived video', async () => {
    const putVideoPlacement = vi.fn().mockResolvedValue({ slug: VIDEO.slug, placement: UNPLACED });
    renderCard({ putVideoPlacement }, { folderId: 'display-ads', categoryId: null, archived: true });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-archive'));
    fireEvent.click(screen.getByTestId('archive-video-submit'));

    await waitFor(() =>
      expect(putVideoPlacement).toHaveBeenCalledWith('editar-campana', {
        folderId: 'display-ads',
        categoryId: null,
        archived: false,
      }),
    );
  });
});

describe('delete modal', () => {
  it('keeps the button disabled until the slug is typed back', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-delete'));

    const submit = screen.getByTestId('delete-video-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('delete-video-confirmation'), { target: { value: 'editar' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('delete-video-confirmation'), {
      target: { value: 'editar-campana' },
    });
    expect(submit.disabled).toBe(false);
  });

  it('spells out the three directories it removes before deleting anything', () => {
    renderCard({});

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-delete'));

    const modal = screen.getByTestId('delete-video-modal');
    expect(modal.textContent).toContain('cannot be undone');
    expect(modal.textContent).toContain('raw/');
    expect(modal.textContent).toContain('work/');
    expect(modal.textContent).toContain('out/');
  });

  it('deletes the video once the name matches', async () => {
    const deleteVideo = vi.fn().mockResolvedValue({ slug: VIDEO.slug, deleted: true });
    const onChanged = renderCard({ deleteVideo });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-delete'));
    fireEvent.change(screen.getByTestId('delete-video-confirmation'), {
      target: { value: 'editar-campana' },
    });
    fireEvent.click(screen.getByTestId('delete-video-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(deleteVideo).toHaveBeenCalledWith('editar-campana');
  });

  it('points out that an archived video is already out of the way', () => {
    renderCard({}, { folderId: null, categoryId: null, archived: true });

    openMenu();
    fireEvent.click(screen.getByTestId('video-card-menu-delete'));

    expect(screen.getByTestId('delete-video-archived-note')).toBeTruthy();
  });
});
