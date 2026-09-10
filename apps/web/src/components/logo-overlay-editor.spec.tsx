import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { LogoOverlayEditor } from './logo-overlay-editor';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetListing } from '../api/render-api-types';
import type { LogoOverlay } from '@video-maker/timeline-core';

const LOGO_MEDIA = {
  id: 'raw/logo/brand.png',
  kind: 'image',
  path: 'raw/logo/brand.png',
  durationMs: 0,
  width: 800,
  height: 200,
  probedAt: '2026-09-01T00:00:00.000Z',
};

function listing(withLogo: boolean, source: AssetListing['source'] = 'catalog'): AssetListing {
  return {
    slug: 'demo-01',
    source,
    assets: withLogo
      ? [
          {
            path: 'raw/logo/brand.png',
            role: 'logo',
            fingerprint: { sizeBytes: 1, modifiedAtMs: 1 },
            media: LOGO_MEDIA as AssetListing['assets'][number]['media'],
          },
        ]
      : [],
    probeFailures: [],
  };
}

function renderEditor(options: {
  assets: AssetListing;
  logo?: LogoOverlay;
}) {
  const dispatch = vi.fn();
  const listAssets = vi.fn().mockResolvedValue(options.assets);

  render(
    <RenderApiProvider client={{ listAssets } as unknown as RenderApiClient}>
      <LogoOverlayEditor
        slug="demo-01"
        {...(options.logo === undefined ? {} : { logo: options.logo })}
        dispatch={dispatch}
      />
    </RenderApiProvider>,
  );

  return dispatch;
}

function checkbox(): HTMLInputElement {
  return screen.getByLabelText('Show logo') as HTMLInputElement;
}

function positionSelect(): HTMLSelectElement {
  return screen.getByLabelText('Logo position') as HTMLSelectElement;
}

describe('LogoOverlayEditor', () => {
  it('turns the logo on with the default position and the catalog asset', async () => {
    const dispatch = renderEditor({ assets: listing(true) });

    await waitFor(() => expect(checkbox().disabled).toBe(false));
    fireEvent.click(checkbox());

    expect(dispatch).toHaveBeenCalledWith({
      type: 'logo-set',
      asset: expect.objectContaining({ id: 'raw/logo/brand.png' }),
      position: 'bottom-right',
    });
  });

  it('moves the logo while it is shown', async () => {
    const dispatch = renderEditor({
      assets: listing(true),
      logo: {
        assetId: 'raw/logo/brand.png',
        position: 'bottom-right',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    });

    await waitFor(() => expect(positionSelect().disabled).toBe(false));
    fireEvent.change(positionSelect(), { target: { value: 'top-left' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'logo-set',
      asset: expect.objectContaining({ id: 'raw/logo/brand.png' }),
      position: 'top-left',
    });
  });

  it('does not touch the timeline when the position changes with the logo off', async () => {
    const dispatch = renderEditor({ assets: listing(true) });

    await waitFor(() => expect(positionSelect().disabled).toBe(false));
    fireEvent.change(positionSelect(), { target: { value: 'top-right' } });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('takes the logo off the timeline when it is unchecked', async () => {
    const dispatch = renderEditor({
      assets: listing(true),
      logo: {
        assetId: 'raw/logo/brand.png',
        position: 'top-left',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    });

    await waitFor(() => expect(checkbox().checked).toBe(true));
    fireEvent.click(checkbox());

    expect(dispatch).toHaveBeenCalledWith({ type: 'logo-clear' });
  });

  it('disables the control with the reason written when the project has no logo', async () => {
    renderEditor({ assets: listing(false) });

    await waitFor(() => expect(screen.getByTestId('logo-blockers')).toBeTruthy());
    expect(checkbox().disabled).toBe(true);
    expect(screen.getByTestId('logo-blockers').textContent).toContain('raw/logo/');
  });

  it('explains the raw-scan case instead of asking for an upload that already happened', async () => {
    renderEditor({ assets: listing(false, 'raw-scan') });

    await waitFor(() =>
      expect(screen.getByTestId('logo-blockers').textContent).toContain('no catalog yet'),
    );
  });

  it('offers the upload of a logo without leaving the page, with the role already fixed', async () => {
    renderEditor({ assets: listing(true) });

    await waitFor(() => expect(screen.getByLabelText('Logo image')).toBeTruthy());
    const roleLabel = screen.getByText('Upload to') as HTMLLabelElement;
    expect(document.getElementById(roleLabel.htmlFor)?.textContent).toBe('logo');
    expect(screen.queryByRole('combobox', { name: 'Upload to' })).toBeNull();
  });
});
