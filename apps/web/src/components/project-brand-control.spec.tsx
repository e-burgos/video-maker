import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { brandSummary } from '../api/__fixtures__/brand';
import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import type { ProjectDetail } from '../api/render-api-types';
import { ProjectBrandControl } from './project-brand-control';

const LAYOUT = { raw: false, catalog: false, timeline: false, edl: false, out: false };

function detail(patch: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    slug: 'promo',
    layout: LAYOUT,
    mode: 'footage',
    brand: null,
    brandMissing: false,
    assetSource: 'raw-scan',
    assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0, reference: 0 },
    ...patch,
  };
}

function renderControl(project: ProjectDetail, client: Partial<RenderApiClient> = {}) {
  const onChanged = vi.fn();
  const full = {
    listBrands: vi.fn().mockResolvedValue([
      brandSummary({ id: 'acme', name: 'Acme' }),
      brandSummary({ id: 'beta', name: 'Beta' }),
    ]),
    putProjectBrand: vi.fn().mockResolvedValue(detail({ brand: 'beta' })),
    ...client,
  } as unknown as RenderApiClient;
  render(
    <RenderApiProvider client={full}>
      <MemoryRouter>
        <ProjectBrandControl slug="promo" project={project} onChanged={onChanged} />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return { client: full, onChanged };
}

describe('ProjectBrandControl', () => {
  it('shows the current brand with its logo and name', async () => {
    renderControl(detail({ brand: 'acme' }));

    await waitFor(() => expect(screen.getByAltText('Logo of Acme')).toBeTruthy());
    expect(screen.getByTestId('project-brand').textContent).toContain('Acme');
  });

  it('shows that the project has no brand', () => {
    renderControl(detail());

    expect(screen.getByTestId('project-brand').textContent).toContain('No brand');
  });

  it('flags a brand that no longer exists, keeping its id', async () => {
    renderControl(detail({ brand: 'gone', brandMissing: true }));

    await waitFor(() => expect(screen.getByTestId('project-brand-missing')).toBeTruthy());
    expect(screen.getByTestId('project-brand').textContent).toContain('gone');
  });

  it('changes the brand through the picker, closes it and tells the caller to reload', async () => {
    const { client, onChanged } = renderControl(detail({ brand: 'acme' }));

    await waitFor(() => expect((screen.getByTestId('project-brand-change') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('project-brand-change'));
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(client.putProjectBrand).toHaveBeenCalledWith('promo', 'beta');
    expect(screen.queryByTestId('project-brand-picker')).toBeNull();
  });

  it('can remove the brand of a footage project but not of a motion one', async () => {
    const { client } = renderControl(detail({ brand: 'acme' }));
    await waitFor(() => expect((screen.getByTestId('project-brand-change') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('project-brand-change'));
    fireEvent.click(screen.getByRole('radio', { name: 'No brand' }));
    await waitFor(() => expect(client.putProjectBrand).toHaveBeenCalledWith('promo', null));
  });

  it('sends a motion project to its brief to change the brand, which the render uses', async () => {
    renderControl(detail({ mode: 'motion', brand: 'acme' }));

    const link = await screen.findByTestId('project-brand-motion-link');

    expect(link.getAttribute('href')).toBe('/projects/promo/motion');
    expect(screen.queryByTestId('project-brand-change')).toBeNull();
  });

  it('keeps the picker open and shows the error when the change fails', async () => {
    const putProjectBrand = vi.fn().mockRejectedValue(new RenderApiError('BRAND_UNKNOWN', 'nope', 404, null));
    const { onChanged } = renderControl(detail({ brand: 'acme' }), { putProjectBrand });
    await waitFor(() => expect((screen.getByTestId('project-brand-change') as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByTestId('project-brand-change'));
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('BRAND_UNKNOWN'));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByTestId('project-brand-picker')).toBeTruthy();
  });
});
