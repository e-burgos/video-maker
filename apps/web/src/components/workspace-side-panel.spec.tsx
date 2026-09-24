import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { assetEntry, assetListing, jobListing, succeededJob } from '../api/__fixtures__/workspace';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { WorkspaceSidePanel } from './workspace-side-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { AsyncResource } from '../hooks/use-async-resource';
import type { AssetListing, RenderJobListing } from '../api/render-api-types';

function readyResource<T>(data: T): AsyncResource<T> {
  return { status: 'ready', data, error: null, isRefreshing: false, reload: vi.fn() };
}

function renderPanel(options: {
  client?: Partial<RenderApiClient>;
  assets?: AsyncResource<AssetListing>;
  jobs?: AsyncResource<RenderJobListing>;
  activeTab?: 'preview' | 'material' | 'deliveries';
} = {}) {
  const client = {
    getTimeline: vi.fn().mockRejectedValue(new RenderApiError('TIMELINE_NOT_FOUND', 'none', 404, null)),
    ...options.client,
  } as unknown as RenderApiClient;

  const onTabChange = vi.fn();

  render(
    <RenderApiProvider client={client}>
      <MemoryRouter>
        <WorkspaceSidePanel
          slug="demo-01"
          activeTab={options.activeTab ?? 'preview'}
          onTabChange={onTabChange}
          assets={options.assets ?? readyResource(assetListing([]))}
          jobs={options.jobs ?? readyResource(jobListing([]))}
        />
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return { client, onTabChange };
}

describe('WorkspaceSidePanel', () => {
  it('switches the visible panel when a tab is clicked', () => {
    const { onTabChange } = renderPanel();

    fireEvent.click(screen.getByTestId('workspace-tab-material'));

    expect(onTabChange).toHaveBeenCalledWith('material');
  });

  it('shows the latest succeeded render instead of the timeline in the preview tab', async () => {
    renderPanel({
      jobs: readyResource(jobListing([succeededJob('render', 'job-1', '2026-09-10T10:00:00.000Z')])),
    });

    await waitFor(() =>
      expect(screen.getByTestId('workspace-preview-video').getAttribute('src')).toContain('job-1.mp4'),
    );
  });

  it('shows an empty state in preview when there is no render and no timeline', async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('workspace-preview-empty')).toBeTruthy());
  });

  it('groups material by role and links to the full library', () => {
    renderPanel({
      activeTab: 'material',
      assets: readyResource(
        assetListing([
          assetEntry({ path: 'raw/aroll/a1.mp4', role: 'aroll' }),
          assetEntry({ path: 'raw/aroll/a2.mp4', role: 'aroll' }),
        ]),
      ),
    });

    const material = screen.getByTestId('workspace-material');
    expect(material.textContent).toContain('2');
    expect(screen.getByRole('link', { name: /Open full library/u }).getAttribute('href')).toBe(
      '/projects/demo-01/library',
    );
  });

  it('shows an empty state in material when the project has no assets yet', () => {
    renderPanel({ activeTab: 'material' });

    expect(screen.getByTestId('workspace-material-empty')).toBeTruthy();
  });

  it('lists succeeded renders newest first in deliveries, with a download link each', () => {
    renderPanel({
      activeTab: 'deliveries',
      jobs: readyResource(
        jobListing([
          succeededJob('render', 'job-old', '2026-09-10T10:00:00.000Z'),
          succeededJob('render', 'job-new', '2026-09-11T10:00:00.000Z'),
        ]),
      ),
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getAllByText('Download')[0]?.getAttribute('href')).toContain('job-new.mp4');
  });

  it('shows an empty state in deliveries when nothing succeeded yet', () => {
    renderPanel({ activeTab: 'deliveries' });

    expect(screen.getByTestId('workspace-deliveries-empty')).toBeTruthy();
  });
});
