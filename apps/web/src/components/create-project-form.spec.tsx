import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateProjectForm } from './create-project-form';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';

function renderForm(createProject: RenderApiClient['createProject'], onCreated = vi.fn()) {
  const client = { createProject } as unknown as RenderApiClient;
  render(
    <RenderApiProvider client={client}>
      <CreateProjectForm onCreated={onCreated} />
    </RenderApiProvider>,
  );
  return onCreated;
}

function typeSlug(value: string) {
  fireEvent.change(screen.getByLabelText('New video'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
}

describe('CreateProjectForm', () => {
  it('rejects a slug the service would reject without emitting a request', async () => {
    const createProject = vi.fn();
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeSlug('Not_A_Slug');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('kebab-case'));
    expect(createProject).not.toHaveBeenCalled();
  });

  it('rejects an empty slug without emitting a request', async () => {
    const createProject = vi.fn();
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Enter a project'));
    expect(createProject).not.toHaveBeenCalled();
  });

  it('creates the project and reports the slug the service answered', async () => {
    const createProject = vi.fn().mockResolvedValue({ slug: 'my-reel' });
    const onCreated = renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeSlug('my-reel');

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('my-reel'));
    expect(createProject).toHaveBeenCalledWith('my-reel');
    expect((screen.getByLabelText('New video') as HTMLInputElement).value).toBe('');
  });

  it('shows the service error code and does not report a creation', async () => {
    const createProject = vi
      .fn()
      .mockRejectedValue(new RenderApiError('PROJECT_ALREADY_EXISTS', 'Already there.', 409, null));
    const onCreated = renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeSlug('my-reel');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('PROJECT_ALREADY_EXISTS'),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('wraps a non typed failure in the transport surface', async () => {
    const createProject = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeSlug('my-reel');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'),
    );
  });
});
