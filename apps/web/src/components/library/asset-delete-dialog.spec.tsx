import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetDeleteDialog } from './asset-delete-dialog';
import { RenderApiError } from '../../api/render-api-error';
import { RenderApiProvider } from '../../api/render-api-context';
import type { RenderApiClient } from '../../api/render-api-client';
import type { AssetDeletion } from '../../api/render-api-types';
import type { DeleteTarget } from './asset-delete-dialog';

const DELETION: AssetDeletion = {
  slug: 'smoke-ingest',
  deleted: {
    path: 'raw/aroll/clip01.mp4',
    role: 'aroll',
    catalogEntryRemoved: true,
    removedArtifacts: [],
  },
  timelineReferences: [],
};

const FIRST: DeleteTarget = { role: 'aroll', path: 'raw/aroll/clip01.mp4' };
const SECOND: DeleteTarget = { role: 'image', path: 'raw/images/photo01.jpg' };

function inUseError(): RenderApiError {
  return new RenderApiError('ASSET_IN_USE', 'still used', 409, {
    code: 'ASSET_IN_USE',
    stage: null,
    message: 'still used',
    resource: 'raw/aroll/clip01.mp4',
    hint: 'asset, tracks.aroll clip clip-aroll-1',
  });
}

function renderDialog(deleteAsset: unknown, targets: DeleteTarget[] = [FIRST]) {
  const onDeleted = vi.fn();
  const onClose = vi.fn();
  render(
    <RenderApiProvider client={{ deleteAsset } as RenderApiClient}>
      <AssetDeleteDialog
        slug="smoke-ingest"
        targets={targets}
        onDeleted={onDeleted}
        onClose={onClose}
      />
    </RenderApiProvider>,
  );
  return { onDeleted, onClose };
}

describe('AssetDeleteDialog', () => {
  it('asks for confirmation by file name before calling the service', () => {
    const deleteAsset = vi.fn();
    renderDialog(deleteAsset);

    expect(screen.getByTestId('asset-delete-confirm').textContent).toContain(
      'Delete clip01.mp4?',
    );
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('closes without deleting when the asset is kept', () => {
    const deleteAsset = vi.fn();
    const { onClose } = renderDialog(deleteAsset);

    fireEvent.click(screen.getByTestId('asset-delete-cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('deletes without force, hands the deletion to the caller and closes', async () => {
    const deleteAsset = vi.fn().mockResolvedValue(DELETION);
    const { onDeleted, onClose } = renderDialog(deleteAsset);

    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDeleted).toHaveBeenCalledWith(DELETION);
    expect(deleteAsset).toHaveBeenCalledWith({
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip01.mp4',
      force: false,
    });
  });

  it('shows the timeline uses on ASSET_IN_USE and deletes anyway on the second try', async () => {
    const deleteAsset = vi
      .fn()
      .mockRejectedValueOnce(inUseError())
      .mockResolvedValueOnce(DELETION);
    const { onDeleted } = renderDialog(deleteAsset);

    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await screen.findByTestId('asset-delete-in-use');
    expect(screen.getByTestId('asset-delete-in-use-uses').textContent).toBe(
      'used as asset, tracks.aroll clip clip-aroll-1',
    );
    expect(screen.queryByTestId('asset-delete-accept')).toBeNull();

    fireEvent.click(screen.getByTestId('asset-delete-force'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteAsset).toHaveBeenNthCalledWith(2, {
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip01.mp4',
      force: true,
    });
  });

  it('deletes several files in order and pauses on the one the timeline uses', async () => {
    const deleteAsset = vi
      .fn()
      .mockResolvedValueOnce(DELETION)
      .mockRejectedValueOnce(inUseError())
      .mockResolvedValueOnce(DELETION);
    const { onDeleted, onClose } = renderDialog(deleteAsset, [SECOND, FIRST]);

    expect(screen.getByTestId('asset-delete-confirm').textContent).toContain(
      'Delete 2 files?',
    );
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await screen.findByTestId('asset-delete-in-use');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(deleteAsset).toHaveBeenNthCalledWith(1, {
      slug: 'smoke-ingest',
      role: 'image',
      filename: 'photo01.jpg',
      force: false,
    });

    fireEvent.click(screen.getByTestId('asset-delete-force'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteAsset).toHaveBeenNthCalledWith(3, {
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip01.mp4',
      force: true,
    });
  });

  it('explains any other failure by its translated code and keeps the dialog open', async () => {
    const deleteAsset = vi.fn().mockRejectedValue(
      new RenderApiError('ASSET_NOT_FOUND', 'missing', 404, {
        code: 'ASSET_NOT_FOUND',
        stage: null,
        message: 'missing',
        resource: 'raw/aroll/clip01.mp4',
      }),
    );
    const { onDeleted, onClose } = renderDialog(deleteAsset);

    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ASSET_NOT_FOUND');
    expect(alert.textContent).toContain(
      'This asset is no longer in the project.',
    );
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports a transport failure the service never answered', async () => {
    renderDialog(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'SERVICE_UNREACHABLE',
    );
  });
});
