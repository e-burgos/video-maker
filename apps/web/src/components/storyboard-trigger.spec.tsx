import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { StoryboardTrigger } from './storyboard-trigger';
import type { RenderApiClient } from '../api/render-api-client';
import type { ServiceHealth, StoryboardJob } from '../api/render-api-types';

function healthyService(storyboardQueue = true): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T12:00:00.000Z',
    engine: [{ name: 'media-local', loaded: true }],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue,
    },
    jobs: { running: 0, queued: 0 },
  };
}

function storyboardJob(): StoryboardJob {
  return {
    id: 'job-0009',
    kind: 'storyboard',
    slug: 'smoke-ingest',
    state: 'queued',
    createdAt: '2026-09-09T12:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
  };
}

function renderTrigger(
  createStoryboardJob: RenderApiClient['createStoryboardJob'],
  health: ServiceHealth = healthyService(),
) {
  const onCreated = vi.fn();
  const getHealth = vi.fn().mockResolvedValue(health);

  render(
    <RenderApiProvider client={{ createStoryboardJob, getHealth } as unknown as RenderApiClient}>
      <StoryboardTrigger slug="smoke-ingest" onCreated={onCreated} />
    </RenderApiProvider>,
  );

  return onCreated;
}

function proposeButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Propose storyboard|Asking the agent/ }) as HTMLButtonElement;
}

function typeBrief(value: string): void {
  fireEvent.change(screen.getByLabelText('Brief'), { target: { value } });
}

describe('StoryboardTrigger', () => {
  it('refuses to propose while the brief is empty, and says why', async () => {
    renderTrigger(vi.fn());

    await waitFor(() => expect(proposeButton().disabled).toBe(true));
    expect(screen.getByText(/Write a brief or paste a script/)).toBeTruthy();
  });

  it('warns in the panel itself that the propose stage takes more than a minute', () => {
    renderTrigger(vi.fn());

    expect(screen.getByText(/takes more than a minute/)).toBeTruthy();
  });

  it('sends the brief with overwrite false and hands the job to its parent', async () => {
    const createStoryboardJob = vi.fn().mockResolvedValue(storyboardJob());
    const onCreated = renderTrigger(createStoryboardJob);

    typeBrief('Tres trucos de terminal');
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() => expect(createStoryboardJob).toHaveBeenCalledTimes(1));
    expect(createStoryboardJob).toHaveBeenCalledWith('smoke-ingest', {
      brief: 'Tres trucos de terminal',
      overwrite: false,
    });
    expect(onCreated).toHaveBeenCalledWith(storyboardJob());
  });

  it('sends scriptText instead of brief once the user switches to the script mode', async () => {
    const createStoryboardJob = vi.fn().mockResolvedValue(storyboardJob());
    renderTrigger(createStoryboardJob);

    fireEvent.click(screen.getByLabelText('Paste a script'));
    fireEvent.change(screen.getByLabelText('Script'), {
      target: { value: 'Escena 1. Nina mira a cámara.' },
    });
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() => expect(createStoryboardJob).toHaveBeenCalledTimes(1));
    expect(createStoryboardJob).toHaveBeenCalledWith('smoke-ingest', {
      scriptText: 'Escena 1. Nina mira a cámara.',
      overwrite: false,
    });
  });

  it('loads an uploaded file into the script field and switches to the script mode', async () => {
    const createStoryboardJob = vi.fn().mockResolvedValue(storyboardJob());
    renderTrigger(createStoryboardJob);

    const file = new File(['Escena 1. Un plano general.'], 'script.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Upload a script file'), { target: { files: [file] } });

    await waitFor(() =>
      expect((screen.getByLabelText('Script') as HTMLTextAreaElement).value).toBe(
        'Escena 1. Un plano general.',
      ),
    );
  });

  it('ignores a file input change that carries no file', async () => {
    renderTrigger(vi.fn());

    fireEvent.change(screen.getByLabelText('Upload a script file'), { target: { files: [] } });

    await waitFor(() => expect(screen.getByLabelText('Brief')).toBeTruthy());
  });

  it('asks for confirmation on 409 and retries with overwrite true only when confirmed', async () => {
    const createStoryboardJob = vi
      .fn()
      .mockRejectedValueOnce(
        new RenderApiError('STORYBOARD_ALREADY_EXISTS', 'already there', 409, null),
      )
      .mockResolvedValueOnce(storyboardJob());
    const onCreated = renderTrigger(createStoryboardJob);

    typeBrief('Tres trucos de terminal');
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
    expect(onCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Overwrite and propose again' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createStoryboardJob).toHaveBeenLastCalledWith('smoke-ingest', {
      brief: 'Tres trucos de terminal',
      overwrite: true,
    });
  });

  it('keeps the stored storyboard when the confirmation is dismissed', async () => {
    const createStoryboardJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('STORYBOARD_ALREADY_EXISTS', 'already there', 409, null));
    renderTrigger(createStoryboardJob);

    typeBrief('Tres trucos');
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Keep the current storyboard' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(createStoryboardJob).toHaveBeenCalledTimes(1);
  });

  it('explains the quota failure in the language of the user, next to its code', async () => {
    const createStoryboardJob = vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('AI_AGENT_RATE_LIMITED', 'the agent is rate limited', 429, null),
      );
    renderTrigger(createStoryboardJob);

    typeBrief('Tres trucos');
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() =>
      expect(screen.getByTestId('storyboard-failure-explanation').textContent).toContain(
        'usage limit',
      ),
    );
    expect(screen.getByText('AI_AGENT_RATE_LIMITED')).toBeTruthy();
  });

  it('shows the raw typed error and no explanation for a code it does not know', async () => {
    const createStoryboardJob = vi
      .fn()
      .mockRejectedValue(new RenderApiError('PROJECT_NOT_FOUND', 'no project', 404, null));
    renderTrigger(createStoryboardJob);

    typeBrief('Tres trucos');
    await waitFor(() => expect(proposeButton().disabled).toBe(false));
    fireEvent.click(proposeButton());

    await waitFor(() => expect(screen.getByText('PROJECT_NOT_FOUND')).toBeTruthy());
    expect(screen.queryByTestId('storyboard-failure-explanation')).toBeNull();
  });

  it('disables the button with the reason written when the service has no storyboard queue', async () => {
    renderTrigger(vi.fn(), healthyService(false));

    typeBrief('Tres trucos');
    await waitFor(() => expect(screen.getByTestId('storyboard-blockers')).toBeTruthy());
    expect(proposeButton().disabled).toBe(true);
    expect(screen.getByTestId('storyboard-blockers').textContent).toContain('storyboard queue');
  });
});
