import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetDeleteControl } from './asset-delete-control';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetDeletion } from '../api/render-api-types';

const DELETION: AssetDeletion = {
  slug: 'smoke-ingest',
  deleted: {
    path: 'raw/aroll/clip01.mp4',
    role: 'aroll',
    catalogEntryRemoved: true,
    removedArtifacts: ['work/transcripts/aroll/clip01.json'],
  },
  timelineReferences: [],
};

function inUseError(): RenderApiError {
  return new RenderApiError(
    'ASSET_IN_USE',
    'The stored timeline still references this asset.',
    409,
    {
      code: 'ASSET_IN_USE',
      stage: null,
      message: 'The stored timeline still references this asset.',
      resource: 'raw/aroll/clip01.mp4',
      hint: 'asset, tracks.aroll clip clip-aroll-1',
    },
  );
}

function renderControl(deleteAsset: RenderApiClient['deleteAsset'], onDeleted = vi.fn()) {
  render(
    <RenderApiProvider client={{ deleteAsset } as RenderApiClient}>
      <AssetDeleteControl
        slug="smoke-ingest"
        role="aroll"
        path="raw/aroll/clip01.mp4"
        onDeleted={onDeleted}
      />
    </RenderApiProvider>,
  );
  return { onDeleted };
}

describe('AssetDeleteControl', () => {
  it('asks for confirmation by file name before calling the service', () => {
    const deleteAsset = vi.fn();
    renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));

    expect(screen.getByTestId('asset-delete-confirm').textContent).toContain('Delete clip01.mp4?');
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('closes the confirmation without deleting when the asset is kept', () => {
    const deleteAsset = vi.fn();
    renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));
    fireEvent.click(screen.getByTestId('asset-delete-cancel'));

    expect(screen.queryByTestId('asset-delete-confirm')).toBeNull();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('deletes without force and hands the deletion to the caller', async () => {
    const deleteAsset = vi.fn().mockResolvedValue(DELETION);
    const { onDeleted } = renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(DELETION));
    expect(deleteAsset).toHaveBeenCalledWith({
      slug: 'smoke-ingest',
      role: 'aroll',
      filename: 'clip01.mp4',
      force: false,
    });
    expect(screen.queryByTestId('asset-delete-confirm')).toBeNull();
  });

  it('shows the timeline uses on ASSET_IN_USE and deletes anyway on the second try', async () => {
    const deleteAsset = vi
      .fn()
      .mockRejectedValueOnce(inUseError())
      .mockResolvedValueOnce({ ...DELETION, timelineReferences: [{ kind: 'asset' as const }] });
    const { onDeleted } = renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));
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

  it('explains any other failure by its translated code and keeps the confirmation open', async () => {
    const deleteAsset = vi.fn().mockRejectedValue(
      new RenderApiError('ASSET_NOT_FOUND', 'The requested asset does not exist in the project.', 404, {
        code: 'ASSET_NOT_FOUND',
        stage: null,
        message: 'The requested asset does not exist in the project.',
        resource: 'raw/aroll/clip01.mp4',
      }),
    );
    const { onDeleted } = renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ASSET_NOT_FOUND');
    expect(alert.textContent).toContain('This asset is no longer in the project.');
    expect(screen.getByTestId('asset-delete-confirm')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('reports a transport failure the service never answered', async () => {
    const deleteAsset = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    renderControl(deleteAsset as unknown as RenderApiClient['deleteAsset']);

    fireEvent.click(screen.getByTestId('asset-delete-open'));
    fireEvent.click(screen.getByTestId('asset-delete-accept'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('SERVICE_UNREACHABLE');
  });
});
