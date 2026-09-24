import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { openRouterModelsResult } from '../api/__fixtures__/producer';
import { RenderApiProvider } from '../api/render-api-context';
import { OpenRouterModelPicker } from './openrouter-model-picker';
import type { RenderApiClient } from '../api/render-api-client';
import type { OpenRouterModelsResult } from '../api/render-api-types';

function renderPicker(
  getOpenRouterModels: RenderApiClient['getOpenRouterModels'],
  value = 'anthropic/claude-haiku-4.5',
  recommendedIds: ReadonlySet<string> = new Set(['anthropic/claude-haiku-4.5']),
) {
  const onChange = vi.fn();
  render(
    <RenderApiProvider client={{ getOpenRouterModels } as RenderApiClient}>
      <OpenRouterModelPicker value={value} onChange={onChange} recommendedIds={recommendedIds} />
    </RenderApiProvider>,
  );
  return onChange;
}

describe('OpenRouterModelPicker', () => {
  it('shows the recommended view by default, with the current model marked as chosen', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels);

    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-card').length).toBeGreaterThan(0));
    expect(getOpenRouterModels).toHaveBeenCalledWith({ scope: 'recommended' });
    expect(screen.getAllByText('Chosen model').length).toBeGreaterThan(0);
  });

  it('switches to the full catalog view and lists every model as a compact row', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels);

    fireEvent.click(screen.getByTestId('openrouter-models-tab-all'));

    await waitFor(() => expect(getOpenRouterModels).toHaveBeenCalledWith({ scope: 'all', q: '', sort: undefined }));
    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-row').length).toBe(3));
  });

  it('filters the full catalog by the search box', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels);
    fireEvent.click(screen.getByTestId('openrouter-models-tab-all'));
    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-row').length).toBe(3));

    fireEvent.change(screen.getByLabelText('Search by name or id'), { target: { value: 'ember' } });

    await waitFor(() =>
      expect(getOpenRouterModels).toHaveBeenCalledWith({ scope: 'all', q: 'ember', sort: undefined }),
    );
  });

  it('sorts the full catalog by price when chosen', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels);
    fireEvent.click(screen.getByTestId('openrouter-models-tab-all'));
    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-row').length).toBe(3));

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'price' } });

    await waitFor(() =>
      expect(getOpenRouterModels).toHaveBeenCalledWith({ scope: 'all', q: '', sort: 'price' }),
    );
  });

  it('calls onChange when a model is picked', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    const onChange = renderPicker(getOpenRouterModels);
    fireEvent.click(screen.getByTestId('openrouter-models-tab-all'));
    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-row').length).toBe(3));

    fireEvent.click(screen.getAllByRole('button', { name: 'Use this model' })[0] as HTMLElement);

    expect(onChange).toHaveBeenCalled();
  });

  it('shows the warning when the chosen model is not recommended', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels, 'fireworks/ember-1', new Set(['anthropic/claude-haiku-4.5']));

    await waitFor(() => expect(screen.getByTestId('openrouter-model-warning')).toBeTruthy());
  });

  it('does not show the warning when the chosen model is recommended', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels, 'anthropic/claude-haiku-4.5', new Set(['anthropic/claude-haiku-4.5']));

    await waitFor(() => expect(screen.getAllByTestId('openrouter-model-card').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('openrouter-model-warning')).toBeNull();
  });

  it('shows a stale notice when the catalog could not be refreshed', async () => {
    const stale: OpenRouterModelsResult = openRouterModelsResult({ stale: true });
    const getOpenRouterModels = vi.fn().mockResolvedValue(stale);
    renderPicker(getOpenRouterModels);

    await waitFor(() => expect(screen.getByText(/could not refresh/)).toBeTruthy());
  });

  it('links to the OpenRouter privacy settings', async () => {
    const getOpenRouterModels = vi.fn().mockResolvedValue(openRouterModelsResult());
    renderPicker(getOpenRouterModels);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'See OpenRouter privacy settings' }).getAttribute('href')).toBe(
        'https://openrouter.ai/settings/privacy',
      ),
    );
  });
});
