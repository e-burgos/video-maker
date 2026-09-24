import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FolderHeading } from './folder-heading';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { VideoFolder } from '../api/render-api-types';
import type { RenderApiClient } from '../api/render-api-client';

const FOLDER: VideoFolder = {
  id: 'display-ads',
  name: 'Display Ads',
  categories: [{ id: 'campanas', name: 'Campañas' }],
};

function renderHeading(
  client: Partial<RenderApiClient>,
  folder: VideoFolder | null = FOLDER,
  total = 3,
  onChanged = vi.fn(),
) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <FolderHeading folder={folder} total={total} onChanged={onChanged} />
    </RenderApiProvider>,
  );
  return onChanged;
}

describe('FolderHeading', () => {
  it('names the folder and counts its videos', () => {
    renderHeading({});

    expect(screen.getByText('Display Ads')).toBeTruthy();
    expect(screen.getByTestId('folder-count').textContent).toBe('(3)');
  });

  it('offers no actions on the No project bucket, which is not a real folder', () => {
    renderHeading({}, null);

    expect(screen.getByText('No project')).toBeTruthy();
    expect(screen.queryByTestId('folder-rename-open')).toBeNull();
    expect(screen.queryByTestId('folder-add-category-open')).toBeNull();
    expect(screen.queryByTestId('folder-delete')).toBeNull();
  });

  it('renames the folder inline, starting from its current name', async () => {
    const renameFolder = vi.fn().mockResolvedValue({ id: 'display-ads', name: 'DA Q1', categories: [] });
    const onChanged = renderHeading({ renameFolder });

    fireEvent.click(screen.getByTestId('folder-rename-open'));
    expect((screen.getByTestId('folder-rename-name') as HTMLInputElement).value).toBe('Display Ads');

    fireEvent.change(screen.getByTestId('folder-rename-name'), { target: { value: 'DA Q1' } });
    fireEvent.click(screen.getByTestId('folder-rename-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(renameFolder).toHaveBeenCalledWith('display-ads', 'DA Q1');
    expect(screen.queryByTestId('folder-rename-form')).toBeNull();
  });

  it('never submits a blank name or the exact same name', () => {
    const renameFolder = vi.fn();
    renderHeading({ renameFolder });

    fireEvent.click(screen.getByTestId('folder-rename-open'));
    expect((screen.getByTestId('folder-rename-submit') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('folder-rename-name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('folder-rename-submit'));
    expect(renameFolder).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('folder-rename-name'), { target: { value: 'Display Ads' } });
    expect((screen.getByTestId('folder-rename-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancels the rename without calling the service', () => {
    const renameFolder = vi.fn();
    renderHeading({ renameFolder });

    fireEvent.click(screen.getByTestId('folder-rename-open'));
    fireEvent.change(screen.getByTestId('folder-rename-name'), { target: { value: 'DA Q1' } });
    fireEvent.click(screen.getByTestId('folder-rename-cancel'));

    expect(screen.queryByTestId('folder-rename-form')).toBeNull();
    expect(renameFolder).not.toHaveBeenCalled();
  });

  it('shows the typed error when renaming fails', async () => {
    const renameFolder = vi
      .fn()
      .mockRejectedValue(new RenderApiError('FOLDER_NAME_TAKEN', 'taken', null, null));
    renderHeading({ renameFolder });

    fireEvent.click(screen.getByTestId('folder-rename-open'));
    fireEvent.change(screen.getByTestId('folder-rename-name'), { target: { value: 'DA Q1' } });
    fireEvent.click(screen.getByTestId('folder-rename-submit'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('FOLDER_NAME_TAKEN'));
  });

  it('creates a category inside this folder', async () => {
    const createCategory = vi.fn().mockResolvedValue({ id: 'reportes', name: 'Reportes' });
    const onChanged = renderHeading({ createCategory });

    fireEvent.click(screen.getByTestId('folder-add-category-open'));
    fireEvent.change(screen.getByTestId('folder-category-name'), { target: { value: 'Reportes' } });
    fireEvent.click(screen.getByTestId('folder-category-submit'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(createCategory).toHaveBeenCalledWith('display-ads', 'Reportes');
  });

  it('does not send an empty category name', () => {
    const createCategory = vi.fn();
    renderHeading({ createCategory });

    fireEvent.click(screen.getByTestId('folder-add-category-open'));
    fireEvent.click(screen.getByTestId('folder-category-submit'));

    expect(createCategory).not.toHaveBeenCalled();
  });

  it('lists the categories with a control to remove each one', async () => {
    const deleteCategory = vi.fn().mockResolvedValue({ folders: [], videos: {} });
    const onChanged = renderHeading({ deleteCategory });

    expect(screen.getByTestId('folder-categories').textContent).toContain('Campañas');
    fireEvent.click(screen.getByLabelText('Delete the category Campañas'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(deleteCategory).toHaveBeenCalledWith('display-ads', 'campanas');
  });

  it('asks before deleting the folder and says the videos survive', () => {
    renderHeading({});

    fireEvent.click(screen.getByTestId('folder-delete'));

    expect(screen.getByTestId('folder-delete-confirm').textContent).toContain(
      'none of them is deleted',
    );
  });

  it('deletes the folder only after the confirmation', async () => {
    const deleteFolder = vi.fn().mockResolvedValue({ folders: [], videos: {} });
    const onChanged = renderHeading({ deleteFolder });

    fireEvent.click(screen.getByTestId('folder-delete'));
    expect(deleteFolder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('folder-delete-accept'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(deleteFolder).toHaveBeenCalledWith('display-ads');
  });

  it('shows the typed error when the service refuses', async () => {
    const deleteFolder = vi
      .fn()
      .mockRejectedValue(new RenderApiError('FOLDER_NOT_FOUND', 'gone', null, null));
    renderHeading({ deleteFolder });

    fireEvent.click(screen.getByTestId('folder-delete'));
    fireEvent.click(screen.getByTestId('folder-delete-accept'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('FOLDER_NOT_FOUND'));
  });
});
