import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RenderApiClient } from '../api/render-api-client';
import { RenderApiProvider } from '../api/render-api-context';
import { ProjectModeGate } from './project-mode-gate';

function renderGate(getProject: RenderApiClient['getProject']) {
  render(
    <RenderApiProvider client={{ getProject } as unknown as RenderApiClient}>
      <ProjectModeGate slug="promo" footage={<p>footage view</p>} motion={<p>motion view</p>} />
    </RenderApiProvider>,
  );
}

describe('ProjectModeGate', () => {
  it('holds both views back while the mode is loading', () => {
    renderGate(vi.fn(() => new Promise(() => undefined)));

    expect(screen.getByText('Loading the project…')).toBeTruthy();
    expect(screen.queryByText('footage view')).toBeNull();
    expect(screen.queryByText('motion view')).toBeNull();
  });

  it('shows the motion view for a motion project', async () => {
    renderGate(vi.fn().mockResolvedValue({ slug: 'promo', mode: 'motion' }));

    expect(await screen.findByText('motion view')).toBeTruthy();
    expect(screen.queryByText('footage view')).toBeNull();
  });

  it('shows the footage view for a footage project, with or without an explicit mode', async () => {
    renderGate(vi.fn().mockResolvedValue({ slug: 'promo' }));

    expect(await screen.findByText('footage view')).toBeTruthy();
  });

  it('falls back to the footage view when the project cannot be loaded', async () => {
    renderGate(vi.fn().mockRejectedValue(new Error('down')));

    expect(await screen.findByText('footage view')).toBeTruthy();
  });
});
