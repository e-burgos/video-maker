import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VOICE_MODELS, healthyVoiceService, voiceJob } from '../api/__fixtures__/voice';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { VoiceTrigger, defaultVoiceId } from './voice-trigger';
import type { RenderApiClient } from '../api/render-api-client';
import type { ServiceHealth, VoiceListing, VoiceModel } from '../api/render-api-types';

function renderTrigger(
  createVoiceJob: RenderApiClient['createVoiceJob'],
  options: { health?: ServiceHealth; voices?: () => Promise<VoiceListing> } = {},
) {
  const onCreated = vi.fn();
  const getHealth = vi.fn().mockResolvedValue(options.health ?? healthyVoiceService());
  const listVoices = vi.fn(options.voices ?? (async () => VOICE_MODELS));

  render(
    <RenderApiProvider client={{ createVoiceJob, getHealth, listVoices } as unknown as RenderApiClient}>
      <VoiceTrigger slug="smoke-ingest" onCreated={onCreated} />
    </RenderApiProvider>,
  );

  return onCreated;
}

function generateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Generate voice-over|Sending/ }) as HTMLButtonElement;
}

describe('defaultVoiceId', () => {
  it('prefers the model PIPER_MODEL_PATH points at', () => {
    expect(defaultVoiceId(VOICE_MODELS)).toBe('es_AR-daniela-high');
  });

  it('falls back to the first voice when none is marked, and to null with no catalogue', () => {
    const [first] = VOICE_MODELS.voices;
    expect(defaultVoiceId({ voices: [{ ...(first as VoiceModel), isDefault: false }] })).toBe(
      'es_AR-daniela-high',
    );
    expect(defaultVoiceId({ voices: [] })).toBeNull();
    expect(defaultVoiceId(null)).toBeNull();
  });
});

describe('VoiceTrigger', () => {
  it('marks the default voice in the selector and sends it when nothing else is picked', async () => {
    const createVoiceJob = vi.fn().mockResolvedValue(voiceJob());
    const onCreated = renderTrigger(createVoiceJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    const cards = screen.getAllByTestId('voice-card');
    expect(cards).toHaveLength(2);
    expect(cards.find((card) => card.dataset['selected'] === 'true')?.dataset['voiceId']).toBe(
      'es_AR-daniela-high',
    );

    fireEvent.click(generateButton());

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenCalledWith('smoke-ingest', {
        voiceId: 'es_AR-daniela-high',
        sceneIds: null,
        overwrite: false,
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(voiceJob()));
  });

  it('sends the voice the user picked instead of the default', async () => {
    const createVoiceJob = vi.fn().mockResolvedValue(voiceJob());
    renderTrigger(createVoiceJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(
      screen.getByLabelText('Use Carlfm \u00b7 Spanish (Spain) \u00b7 Very low quality'),
    );
    fireEvent.click(generateButton());

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenCalledWith('smoke-ingest', {
        voiceId: 'es_ES-carlfm-x-low',
        sceneIds: null,
        overwrite: false,
      }),
    );
  });

  it('explains VOICE_MODEL_UNAVAILABLE instead of pretending there are no voices', async () => {
    const createVoiceJob = vi.fn();
    renderTrigger(createVoiceJob, {
      voices: async () => {
        throw new RenderApiError('VOICE_MODEL_UNAVAILABLE', 'voice engine is not configured', 503, null);
      },
    });

    await waitFor(() => expect(screen.getByTestId('voice-catalogue-error')).toBeDefined());
    expect(screen.getByText(/VOICE_MODEL_UNAVAILABLE/)).toBeDefined();
    expect(screen.getByText(/TTS_VOICES_DIR/)).toBeDefined();
    expect(generateButton().disabled).toBe(true);
    expect(createVoiceJob).not.toHaveBeenCalled();
  });

  it('separates an empty catalogue from an unconfigured voice engine', async () => {
    renderTrigger(vi.fn(), { voices: async () => ({ voices: [] }) });

    await waitFor(() => expect(screen.getByTestId('voice-catalogue-empty')).toBeDefined());
    expect(screen.queryByTestId('voice-catalogue-error')).toBeNull();
    expect(generateButton().disabled).toBe(true);
  });

  it('blocks with the reason written when the voice engine binary is missing', async () => {
    const health = healthyVoiceService();
    renderTrigger(vi.fn(), {
      health: {
        ...health,
        status: 'degraded',
        binaries: health.binaries.map((binary) =>
          binary.name === 'ttsCli' ? { ...binary, resolved: false } : binary,
        ),
      },
    });

    await waitFor(() => expect(screen.getByTestId('voice-blockers')).toBeDefined());
    expect(screen.getByText('TTS_CLI_PATH is not set.')).toBeDefined();
    expect(generateButton().disabled).toBe(true);
  });

  it('blocks when the service exposes no voice queue', async () => {
    const health = healthyVoiceService();
    renderTrigger(vi.fn(), {
      health: { ...health, capabilities: { ...health.capabilities, voiceQueue: false } },
    });

    await waitFor(() => expect(screen.getByTestId('voice-blockers')).toBeDefined());
    expect(screen.getByText('The render service does not expose a voice queue.')).toBeDefined();
  });

  it('turns a 409 into a confirmation that retries with overwrite', async () => {
    const createVoiceJob = vi
      .fn()
      .mockRejectedValueOnce(
        new RenderApiError('VOICE_ALREADY_EXISTS', 'those scenes already have a track', 409, null),
      )
      .mockResolvedValueOnce(voiceJob());
    const onCreated = renderTrigger(createVoiceJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeDefined());
    expect(onCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Overwrite and generate again' }));

    await waitFor(() =>
      expect(createVoiceJob).toHaveBeenLastCalledWith('smoke-ingest', {
        voiceId: 'es_AR-daniela-high',
        sceneIds: null,
        overwrite: true,
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('keeps the existing voice-over when the confirmation is dismissed', async () => {
    const createVoiceJob = vi.fn().mockRejectedValue(
      new RenderApiError('VOICE_ALREADY_EXISTS', 'those scenes already have a track', 409, null),
    );
    renderTrigger(createVoiceJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Keep the current voice-over' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(createVoiceJob).toHaveBeenCalledTimes(1);
  });

  it('shows the service code next to the explanation, never instead of it', async () => {
    const createVoiceJob = vi.fn().mockRejectedValue(
      new RenderApiError('STORYBOARD_NOT_FOUND', 'no storyboard', 404, null),
    );
    renderTrigger(createVoiceJob);

    await waitFor(() => expect(generateButton().disabled).toBe(false));
    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.getByTestId('voice-failure-explanation')).toBeDefined());
    expect(screen.getByText(/STORYBOARD_NOT_FOUND/)).toBeDefined();
  });
});
