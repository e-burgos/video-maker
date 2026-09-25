import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { CreateProjectByDrop } from './create-project-by-drop';
import type { RenderApiClient } from '../api/render-api-client';

function file(name: string, type = 'video/mp4'): File {
  return new File(['x'], name, { type });
}

function renderZone(client: Partial<RenderApiClient> = {}, existingSlugs: readonly string[] = []) {
  const withDefaults = {
    createProject: vi.fn().mockResolvedValue({
      slug: 'my-video-ad',
      layout: { raw: true, catalog: false, timeline: false, edl: false, out: false },
      assetSource: 'raw-scan',
      assetCounts: { aroll: 0, broll: 0, image: 0, audio: 0, voice: 0, logo: 0 },
    }),
    uploadToInbox: vi.fn().mockResolvedValue({
      id: 'inbox-0001',
      fileName: 'My Video Ad.mp4',
      path: 'raw/inbox/My Video Ad.mp4',
      proposedRole: 'aroll',
      proposalReason: 'has-audio',
      probe: { kind: 'video', durationMs: 1000, hasAudio: true },
      status: 'pending',
    }),
    ...client,
  } as unknown as RenderApiClient;

  render(
    <RenderApiProvider client={withDefaults}>
      <MemoryRouter>
        <CreateProjectByDrop existingSlugs={existingSlugs}>
          <p>projects list</p>
        </CreateProjectByDrop>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

describe('CreateProjectByDrop', () => {
  it('shows the overlay only while a file is dragged over it', () => {
    renderZone();
    const zone = screen.getByTestId('create-project-drop-zone');

    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByTestId('create-project-overlay').textContent).toBe(
      'Drop to create a new project',
    );

    fireEvent.dragLeave(zone, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByTestId('create-project-overlay')).toBeNull();
  });

  it('creates a project from the dropped file name and uploads it to the new inbox', async () => {
    const client = renderZone();

    fireEvent.drop(screen.getByTestId('create-project-drop-zone'), {
      dataTransfer: { types: ['Files'], files: [file('My Video Ad.mp4')] },
    });

    await waitFor(() => expect(client.createProject).toHaveBeenCalledWith('my-video-ad'));
    expect(client.uploadToInbox).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'my-video-ad', filename: 'My Video Ad.mp4' }),
    );
  });

  it('avoids a slug collision with an existing project', async () => {
    const client = renderZone({}, ['my-video-ad']);

    fireEvent.drop(screen.getByTestId('create-project-drop-zone'), {
      dataTransfer: { types: ['Files'], files: [file('My Video Ad.mp4')] },
    });

    await waitFor(() => expect(client.createProject).toHaveBeenCalledWith('my-video-ad-2'));
  });

  it('ignores a dropped file type the studio does not support', () => {
    const client = renderZone();

    fireEvent.drop(screen.getByTestId('create-project-drop-zone'), {
      dataTransfer: { types: ['Files'], files: [file('notes.txt', 'text/plain')] },
    });

    expect(client.createProject).not.toHaveBeenCalled();
  });

  it('shows a typed error when creating the project fails', async () => {
    const client = renderZone({
      createProject: vi.fn().mockRejectedValue(new RenderApiError('PROJECT_ALREADY_EXISTS', 'nope', 409, null)),
    });

    fireEvent.drop(screen.getByTestId('create-project-drop-zone'), {
      dataTransfer: { types: ['Files'], files: [file('My Video Ad.mp4')] },
    });

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(client.uploadToInbox).not.toHaveBeenCalled();
  });
});
