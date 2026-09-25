import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiError } from '../api/render-api-error';
import { AssetProposalCard } from './asset-proposal-card';
import type { InboxAsset } from '../api/render-api-types';

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

describe('AssetProposalCard', () => {
  it('shows the file name, the translated reason and the proposed role selected', () => {
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByText('clip01.mp4')).toBeTruthy();
    expect(screen.getByText('has a voice track')).toBeTruthy();
    expect((screen.getByTestId('asset-proposal-role') as HTMLSelectElement).value).toBe('aroll');
  });

  it('renders a video thumbnail for a video probe and an icon for audio', () => {
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset({ probe: { kind: 'audio', durationMs: 4000 } })}
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByTestId('asset-proposal-audio-icon')).toBeTruthy();
  });

  it('confirms with the role currently selected, even if changed from the proposal', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        onConfirm={onConfirm}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('asset-proposal-role'), { target: { value: 'broll' } });
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('inbox-0001', 'broll'));
  });

  it('discards the asset when asked to', async () => {
    const onDiscard = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        onConfirm={vi.fn()}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => expect(onDiscard).toHaveBeenCalledWith('inbox-0001'));
  });

  it('shows an error notice when confirming fails, without crashing', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new RenderApiError('ASSET_ROLE_INVALID', 'bad role', 422, null));
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        onConfirm={onConfirm}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
