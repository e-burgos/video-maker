import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { voiceJob } from '../api/__fixtures__/voice';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { VoiceJobPanel } from './voice-job-panel';
import type { RenderApiClient } from '../api/render-api-client';

function renderPanel(getRenderJob: RenderApiClient['getRenderJob'], jobId: string | null = 'job-voice-1') {
  const onSucceeded = vi.fn();

  render(
    <RenderApiProvider client={{ getRenderJob } as unknown as RenderApiClient}>
      <VoiceJobPanel jobId={jobId} onSucceeded={onSucceeded} onRetried={vi.fn()} />
    </RenderApiProvider>,
  );

  return onSucceeded;
}

describe('VoiceJobPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing until a job has been created', () => {
    const { container } = render(
      <RenderApiProvider client={{ getRenderJob: vi.fn() } as unknown as RenderApiClient}>
        <VoiceJobPanel jobId={null} onSucceeded={vi.fn()} onRetried={vi.fn()} />
      </RenderApiProvider>,
    );

    expect(container.textContent).toBe('');
  });

  it('counts the scenes of the stage it is running, not just the stage name', async () => {
    renderPanel(vi.fn().mockResolvedValue(voiceJob()));

    await waitFor(() => expect(screen.getByTestId('voice-stage').textContent).toBe('stage: synthesize'));
    expect(screen.getByTestId('voice-scene-progress').textContent).toContain('scene 2 of 5');
    expect(screen.getByTestId('voice-scene-progress').textContent).toContain('40%');
    expect(screen.getByText('sherpa-onnx is reading the narration of every scene.')).toBeDefined();
  });

  it('names the transcribe stage as the word by word alignment', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        voiceJob({
          progress: { stage: 'transcribe', processedScenes: 5, totalScenes: 5, percent: 100 },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByTestId('voice-stage').textContent).toBe('stage: transcribe'));
    expect(screen.getByText('Whisper is aligning every track word by word.')).toBeDefined();
  });

  it('hides the counter on a stage the service does not count', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        voiceJob({
          progress: { stage: 'persist', processedScenes: null, totalScenes: null, percent: null },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByTestId('voice-stage').textContent).toBe('stage: persist'));
    expect(screen.queryByTestId('voice-scene-progress')).toBeNull();
  });

  it('reports the manifest and the voice once the job succeeds, and only then reloads', async () => {
    const succeeded = voiceJob({
      state: 'succeeded',
      finishedAt: '2026-09-09T02:36:30.000Z',
      progress: { stage: 'persist', processedScenes: null, totalScenes: null, percent: null },
      report: {
        source: 'storyboard',
        track: null,
        manifestPath: 'work/voice/manifest.json',
        storyboardId: 'sb',
        voiceId: 'es_AR-daniela-high',
        language: 'es-AR',
        scenes: [
          {
            sceneId: 'scene-01',
            path: 'work/voice/scene-01.wav',
            wordsPath: 'work/voice/scene-01.words.json',
            durationMs: 3100,
            source: 'generated',
          },
        ],
      },
    });
    const onSucceeded = renderPanel(vi.fn().mockResolvedValue(succeeded));

    await waitFor(() => expect(onSucceeded).toHaveBeenCalledTimes(1));
    const report = screen.getByText(/1 tracks/);
    expect(report.textContent).toContain('work/voice/manifest.json');
    expect(report.textContent).toContain('es_AR-daniela-high');
    expect(report.textContent).toContain('es-AR');
    expect(screen.getByTestId('voice-job-panel').getAttribute('data-voice-state')).toBe('succeeded');
  });

  it('shows the typed failure code and its explanation together', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        voiceJob({
          state: 'failed',
          finishedAt: '2026-09-09T02:36:30.000Z',
          progress: null,
          error: {
            code: 'VOICE_TRANSCRIPTION_FAILED',
            stage: 'transcribe',
            message: 'whisper-cli exited with 1',
          },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('VOICE_TRANSCRIPTION_FAILED'));
    expect(screen.getByTestId('voice-failure-explanation').textContent).toContain('manifest');
  });

  it('explains a job the service lost across a restart', async () => {
    renderPanel(
      vi.fn().mockRejectedValue(new RenderApiError('RENDER_JOB_NOT_FOUND', 'no such job', 404, null)),
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('RENDER_JOB_NOT_FOUND'));
    expect(screen.getByRole('alert').textContent).toContain('restarted');
  });

  it('shows the Interrupted badge instead of the generic failure text for JOB_INTERRUPTED, plus a retry button', async () => {
    renderPanel(
      vi.fn().mockResolvedValue(
        voiceJob({
          state: 'failed',
          progress: null,
          error: { code: 'JOB_INTERRUPTED', stage: null, message: 'interrupted' },
        }),
      ),
    );

    await waitFor(() => expect(screen.getByText('Interrupted')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy();
  });
});
