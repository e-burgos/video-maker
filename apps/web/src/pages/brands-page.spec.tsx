import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { brandDetail, brandSummary } from '../api/__fixtures__/brand';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import type { RenderApiClient } from '../api/render-api-client';
import { BrandsPage } from './brands-page';

const BUILT_IN = brandSummary({ id: 'displayads', name: 'DisplayAds', source: 'built-in' });
const MINE = brandSummary({ id: 'mine', name: 'Mine' });

function renderPage(client: Partial<RenderApiClient>) {
  const withDefaults: Partial<RenderApiClient> = {
    listBrands: vi.fn().mockResolvedValue([BUILT_IN, MINE]),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/brands']}>
        <Routes>
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/brands/:id" element={<p data-testid="editor-route">editor</p>} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

describe('BrandsPage', () => {
  it('lists the brands with logo, source badge and the four palette swatches', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('brand-card-mine')).toBeTruthy());
    expect(screen.getByTestId('brand-source-mine').textContent).toBe('yours');
    expect(screen.getByTestId('brand-source-displayads').textContent).toBe('included');
    expect(screen.getByAltText('Logo of Mine').getAttribute('src')).toBe('/api/brands/mine/files/img/logo.svg');
    expect(screen.getByTestId('brand-swatch-mine-accent').getAttribute('style')).toContain('rgb(14, 165, 233)');
    expect(screen.getAllByTestId(/^brand-swatch-mine-/u)).toHaveLength(4);
  });

  it('only offers to delete the brands that belong to the user', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('brand-card-mine')).toBeTruthy());
    expect(screen.getByTestId('brand-delete-mine')).toBeTruthy();
    expect(screen.queryByTestId('brand-delete-displayads')).toBeNull();
  });

  it('creates a brand from a name and opens its editor', async () => {
    const createBrand = vi.fn().mockResolvedValue(brandDetail({ id: 'nueva' }));
    renderPage({ createBrand });

    await waitFor(() => expect(screen.getByTestId('brand-create')).toBeTruthy());
    fireEvent.click(screen.getByTestId('brand-create'));
    fireEvent.change(screen.getByTestId('brand-create-modal-name'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByTestId('brand-create-modal-submit'));

    await waitFor(() => expect(createBrand).toHaveBeenCalledWith({ name: 'Nueva' }));
    await waitFor(() => expect(screen.getByTestId('editor-route')).toBeTruthy());
  });

  it('duplicates a brand asking for a name', async () => {
    const createBrand = vi.fn().mockResolvedValue(brandDetail({ id: 'copia' }));
    renderPage({ createBrand });

    await waitFor(() => expect(screen.getByTestId('brand-duplicate-displayads')).toBeTruthy());
    fireEvent.click(screen.getByTestId('brand-duplicate-displayads'));
    fireEvent.change(screen.getByTestId('brand-duplicate-modal-name'), { target: { value: 'Mi DisplayAds' } });
    fireEvent.click(screen.getByTestId('brand-duplicate-modal-submit'));

    await waitFor(() =>
      expect(createBrand).toHaveBeenCalledWith({ name: 'Mi DisplayAds', duplicateFrom: 'displayads' }),
    );
  });

  it('shows the error of a name already taken inside the modal', async () => {
    const createBrand = vi.fn().mockRejectedValue(new RenderApiError('BRAND_EXISTS', 'taken', 409, null));
    renderPage({ createBrand });

    await waitFor(() => expect(screen.getByTestId('brand-create')).toBeTruthy());
    fireEvent.click(screen.getByTestId('brand-create'));
    fireEvent.change(screen.getByTestId('brand-create-modal-name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('brand-create-modal-submit'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('BRAND_EXISTS'));
  });

  it('confirms before deleting, explains the trash and reloads the list', async () => {
    const deleteBrand = vi.fn().mockResolvedValue(undefined);
    const listBrands = vi.fn().mockResolvedValue([BUILT_IN, MINE]);
    renderPage({ deleteBrand, listBrands });

    await waitFor(() => expect(screen.getByTestId('brand-delete-mine')).toBeTruthy());
    fireEvent.click(screen.getByTestId('brand-delete-mine'));
    expect(screen.getByTestId('brand-delete-modal').textContent).toContain('brands/.trash');
    expect(deleteBrand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('brand-delete-confirm'));

    await waitFor(() => expect(deleteBrand).toHaveBeenCalledWith('mine'));
    await waitFor(() => expect(listBrands).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('brand-delete-modal')).toBeNull();
  });

  it('explains the failure to list the brands and lets the user retry', async () => {
    const listBrands = vi.fn().mockRejectedValue(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null));
    renderPage({ listBrands });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(listBrands).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when there are no brands', async () => {
    renderPage({ listBrands: vi.fn().mockResolvedValue([]) });

    await waitFor(() => expect(screen.getByTestId('brands-empty')).toBeTruthy());
  });
});
