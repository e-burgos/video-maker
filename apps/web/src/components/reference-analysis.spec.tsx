import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { referenceBrief, referenceJob } from '../api/__fixtures__/reference';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { ReferenceAnalysis } from './reference-analysis';
import type { RenderApiClient } from '../api/render-api-client';

function renderAnalysis(client: Partial<RenderApiClient>) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <ReferenceAnalysis slug="demo-01" assetPath="raw/reference/demo.mp4" />
    </RenderApiProvider>,
  );
}

const notAnalyzed = () => new RenderApiError('REFERENCE_NOT_FOUND', 'none', 404, null);

describe('ReferenceAnalysis', () => {
  it('offers the first analysis when the reference has no brief', async () => {
    const getReference = vi.fn().mockRejectedValue(notAnalyzed());
    renderAnalysis({ getReference });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze reference' })).toBeTruthy());
    expect(getReference).toHaveBeenCalledWith('demo-01', 'demo');
    expect(screen.queryByTestId('reference-brief')).toBeNull();
  });

  it('shows the brief and offers to analyze again when it exists', async () => {
    renderAnalysis({ getReference: vi.fn().mockResolvedValue(referenceBrief()) });

    await waitFor(() => expect(screen.getByTestId('reference-brief')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Analyze again' })).toBeTruthy();
  });

  it('queues the job, shows the stage and reloads the brief when it finishes', async () => {
    const getReference = vi.fn().mockRejectedValueOnce(notAnalyzed()).mockResolvedValue(referenceBrief());
    const createReferenceJob = vi.fn().mockResolvedValue(referenceJob({ state: 'queued', progress: null }));
    const getRenderJob = vi
      .fn()
      .mockResolvedValueOnce(referenceJob())
      .mockResolvedValue(referenceJob({ state: 'succeeded' }));
    renderAnalysis({ getReference, createReferenceJob, getRenderJob });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze reference' })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Analyze reference' }));
    });

    expect(createReferenceJob).toHaveBeenCalledWith('demo-01', 'raw/reference/demo.mp4');
    await waitFor(() => expect(screen.getByTestId('reference-brief')).toBeTruthy(), { timeout: 4000 });
    expect(getReference).toHaveBeenCalledTimes(2);
  });

  it('explains the error when the job cannot be queued', async () => {
    const createReferenceJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('REFERENCE_FILE_INVALID', 'bad', 422, null));
    renderAnalysis({ getReference: vi.fn().mockRejectedValue(notAnalyzed()), createReferenceJob });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze reference' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Analyze reference' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('REFERENCE_FILE_INVALID')).toBeTruthy();
    expect(alert.textContent).toContain('directly in the reference role');
  });

  it('shows the failure of a job that ran and failed', async () => {
    const failed = referenceJob({
      state: 'failed',
      progress: null,
      error: { code: 'REFERENCE_FILE_NOT_FOUND', stage: null, message: 'gone' },
    });
    renderAnalysis({
      getReference: vi.fn().mockRejectedValue(notAnalyzed()),
      createReferenceJob: vi.fn().mockResolvedValue(referenceJob({ state: 'queued', progress: null })),
      getRenderJob: vi.fn().mockResolvedValue(failed),
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze reference' })).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Analyze reference' }));
    });

    const alert = await screen.findByRole('alert', undefined, { timeout: 4000 });
    expect(alert.textContent).toContain('REFERENCE_FILE_NOT_FOUND');
  });
});
