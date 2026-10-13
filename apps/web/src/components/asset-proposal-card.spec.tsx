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

  it('proposes reference with its explanation for a video named like an example', () => {
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset({ fileName: 'referencia-ritmo.mp4' })}
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect((screen.getByTestId('asset-proposal-role') as HTMLSelectElement).value).toBe('reference');
    expect(screen.getByTestId('asset-proposal-reference-suggestion').textContent).toContain(
      'file name looks like an example',
    );
    expect(screen.getByTestId('asset-proposal-reference-note').textContent).toContain(
      'not used as editing material',
    );
  });

  it('confirms a suggested reference with the reference role', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset({ fileName: 'ejemplo.mp4' })}
        onConfirm={onConfirm}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('asset-proposal-confirm'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('inbox-0001', 'reference'));
  });

  it('offers but does not propose reference for a plain video in a footage project', () => {
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        mode="footage"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    const select = screen.getByTestId('asset-proposal-role') as HTMLSelectElement;
    expect(select.value).toBe('aroll');
    expect(Array.from(select.options).map((option) => option.value)).toContain('reference');
    expect(screen.queryByTestId('asset-proposal-reference-suggestion')).toBeNull();

    fireEvent.change(select, { target: { value: 'reference' } });
    expect(screen.getByTestId('asset-proposal-reference-note')).toBeTruthy();
    expect(screen.queryByTestId('asset-proposal-reference-suggestion')).toBeNull();
  });

  it('proposes reference for a video in a motion project and when the request says like this one', () => {
    const { unmount } = render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        mode="motion"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect((screen.getByTestId('asset-proposal-role') as HTMLSelectElement).value).toBe('reference');
    unmount();

    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset()}
        requestText="Quiero un video como este"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect((screen.getByTestId('asset-proposal-role') as HTMLSelectElement).value).toBe('reference');
    expect(screen.getByTestId('asset-proposal-reference-suggestion').textContent).toContain(
      'a video like this one',
    );
  });

  it('never offers reference for an image', () => {
    render(
      <AssetProposalCard
        slug="demo-01"
        asset={inboxAsset({
          fileName: 'referencia.png',
          proposedRole: 'image',
          proposalReason: 'image',
          probe: { kind: 'image', durationMs: 0 },
        })}
        mode="motion"
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    const select = screen.getByTestId('asset-proposal-role') as HTMLSelectElement;
    expect(select.value).toBe('image');
    expect(Array.from(select.options).map((option) => option.value)).not.toContain('reference');
  });
});
