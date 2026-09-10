import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { MontageTrigger } from './montage-trigger';
import type { RenderApiClient } from '../api/render-api-client';
import type { MontageJob, ServiceHealth } from '../api/render-api-types';

function healthyService(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    time: '2026-09-09T10:00:00.000Z',
    engine: [{ name: 'media-local', loaded: true }],
    binaries: [
      { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
      { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
      { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
      { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: true },
    ],
    capabilities: { renderPipeline: true, assetStore: true, jobQueue: true, montageQueue: true, storyboardQueue: true },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

function montageJob(): MontageJob {
  return {
    id: 'job-0002',
    kind: 'montage',
    slug: 'smoke-ingest',
    state: 'queued',
    createdAt: '2026-09-09T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
  };
}

function renderTrigger(
  createMontageJob: RenderApiClient['createMontageJob'],
  health: ServiceHealth = healthyService(),
) {
  const onCreated = vi.fn();
  const getHealth = vi.fn().mockResolvedValue(health);

  render(
    <RenderApiProvider client={{ createMontageJob, getHealth } as unknown as RenderApiClient}>
      <MontageTrigger slug="smoke-ingest" onCreated={onCreated} />
    </RenderApiProvider>,
  );

  return onCreated;
}

function generateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Generate montage' }) as HTMLButtonElement;
}

describe('MontageTrigger', () => {
  it('creates a montage job with the default preset and seed of the spec', async () => {
    const createMontageJob = vi.fn().mockResolvedValue(montageJob());
    const onCreated = renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() =>
      expect(createMontageJob).toHaveBeenCalledWith('smoke-ingest', {
        preset: 'software-demo',
        seed: 0,
        overwrite: false,
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(montageJob());
  });

  it('sends the preset and the seed the dev picked', async () => {
    const createMontageJob = vi.fn().mockResolvedValue(montageJob());
    renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Montage preset'), { target: { value: 'educational' } });
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '42' } });
    fireEvent.click(generateButton());

    await waitFor(() =>
      expect(createMontageJob).toHaveBeenCalledWith('smoke-ingest', {
        preset: 'educational',
        seed: 42,
        overwrite: false,
      }),
    );
  });

  it('offers the four presets of the engine', async () => {
    renderTrigger(vi.fn());

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    const options = screen
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(options).toEqual(['software-demo', 'hardware', 'recipe', 'educational']);
  });

  it('refuses a seed that is not a non-negative integer, without calling the service', async () => {
    const createMontageJob = vi.fn();
    renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '-1' } });

    expect(generateButton().disabled).toBe(true);
    expect(screen.getByText('The seed must be a non-negative integer.')).toBeTruthy();
    expect(createMontageJob).not.toHaveBeenCalled();
  });

  it('disables the montage when the service resolves no Whisper model, naming the env var', async () => {
    const createMontageJob = vi.fn();
    renderTrigger(
      createMontageJob,
      healthyService({
        status: 'degraded',
        binaries: [
          { name: 'ffmpeg', envVar: 'FFMPEG_PATH', resolved: true },
          { name: 'ffprobe', envVar: 'FFPROBE_PATH', resolved: true },
          { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH', resolved: true },
          { name: 'whisperModel', envVar: 'WHISPER_MODEL_PATH', resolved: false },
        ],
      }),
    );

    await waitFor(() => expect(screen.getByTestId('montage-blockers')).toBeTruthy());
    expect(screen.getByText('whisperModel is not resolved (WHISPER_MODEL_PATH).')).toBeTruthy();
    expect(generateButton().disabled).toBe(true);
  });

  it('disables the montage when the service exposes no montage queue', async () => {
    renderTrigger(
      vi.fn(),
      healthyService({
        capabilities: {
          renderPipeline: true,
          assetStore: true,
          jobQueue: true,
          montageQueue: false,
          storyboardQueue: true,
          voiceQueue: true,
        },
      }),
    );

    await waitFor(() => expect(screen.getByTestId('montage-blockers')).toBeTruthy());
    expect(generateButton().disabled).toBe(true);
  });

  it('asks for confirmation on 409 TIMELINE_ALREADY_EXISTS and retries with overwrite: true', async () => {
    const createMontageJob = vi
      .fn()
      .mockRejectedValueOnce(
        new RenderApiError('TIMELINE_ALREADY_EXISTS', 'The project already has a timeline.', 409, {
          code: 'TIMELINE_ALREADY_EXISTS',
          stage: null,
          message: 'The project already has a timeline.',
        }),
      )
      .mockResolvedValueOnce(montageJob());
    const onCreated = renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
    expect(screen.getByText(/overwrites the edited timeline/i)).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Overwrite and regenerate' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(montageJob()));
    expect(createMontageJob).toHaveBeenNthCalledWith(2, 'smoke-ingest', {
      preset: 'software-demo',
      seed: 0,
      overwrite: true,
    });
  });

  it('keeps the timeline untouched when the confirmation is dismissed', async () => {
    const createMontageJob = vi.fn().mockRejectedValue(
      new RenderApiError('TIMELINE_ALREADY_EXISTS', 'The project already has a timeline.', 409, {
        code: 'TIMELINE_ALREADY_EXISTS',
        stage: null,
        message: 'The project already has a timeline.',
      }),
    );
    renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Keep the current timeline' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(createMontageJob).toHaveBeenCalledTimes(1);
  });

  it('shows any other typed error with its code, never as a confirmation', async () => {
    const createMontageJob = vi.fn().mockRejectedValue(
      new RenderApiError('MONTAGE_RAW_MISSING', 'The project has no raw asset role directories.', 422, {
        code: 'MONTAGE_RAW_MISSING',
        stage: null,
        message: 'The project has no raw asset role directories.',
      }),
    );
    renderTrigger(createMontageJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('MONTAGE_RAW_MISSING')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
