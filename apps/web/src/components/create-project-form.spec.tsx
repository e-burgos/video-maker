import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateProjectForm } from './create-project-form';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';

function renderForm(
  createProject: RenderApiClient['createProject'],
  onCreated = vi.fn(),
  existingSlugs: readonly string[] = [],
  onCancel?: () => void,
) {
  const client = { createProject } as unknown as RenderApiClient;
  render(
    <RenderApiProvider client={client}>
      <CreateProjectForm existingSlugs={existingSlugs} onCreated={onCreated} onCancel={onCancel} />
    </RenderApiProvider>,
  );
  return onCreated;
}

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Video name'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create video' }));
}

describe('CreateProjectForm', () => {
  it('rejects an empty name without emitting a request', async () => {
    const createProject = vi.fn();
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    fireEvent.click(screen.getByRole('button', { name: 'Create video' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Enter a name'));
    expect(createProject).not.toHaveBeenCalled();
  });

  it('derives a kebab-case slug from a human name and creates the video', async () => {
    const createProject = vi.fn().mockResolvedValue({ slug: 'my-next-reel' });
    const onCreated = renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeName('My next reel!');

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('my-next-reel'));
    expect(createProject).toHaveBeenCalledWith({ slug: 'my-next-reel', mode: 'footage' });
    expect((screen.getByLabelText('Video name') as HTMLInputElement).value).toBe('');
  });

  it('avoids a slug collision with an existing video', async () => {
    const createProject = vi.fn().mockResolvedValue({ slug: 'my-next-reel-2' });
    renderForm(createProject as unknown as RenderApiClient['createProject'], vi.fn(), ['my-next-reel']);

    typeName('My next reel');

    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ slug: 'my-next-reel-2', mode: 'footage' }));
  });

  it('shows the service error code and does not report a creation', async () => {
    const createProject = vi
      .fn()
      .mockRejectedValue(new RenderApiError('PROJECT_ALREADY_EXISTS', 'Already there.', 409, null));
    const onCreated = renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeName('My reel');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('PROJECT_ALREADY_EXISTS'),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('wraps a non typed failure in the transport surface', async () => {
    const createProject = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    typeName('My reel');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'),
    );
  });

  it('offers a cancel button only when the caller wants one', () => {
    renderForm(vi.fn() as unknown as RenderApiClient['createProject'], vi.fn(), [], vi.fn());

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('offers a labelled radio group with raw footage selected by default', () => {
    renderForm(vi.fn() as unknown as RenderApiClient['createProject']);

    const group = screen.getByRole('radiogroup', { name: 'How do you want to build the video?' });
    expect(group).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Raw footage/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: /Motion graphics/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('sends mode motion when Motion graphics is chosen', async () => {
    const createProject = vi.fn().mockResolvedValue({ slug: 'promo' });
    renderForm(createProject as unknown as RenderApiClient['createProject']);

    fireEvent.click(screen.getByRole('radio', { name: /Motion graphics/ }));
    typeName('Promo');

    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ slug: 'promo', mode: 'motion' }));
  });
});
