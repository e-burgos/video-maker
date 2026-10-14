import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { openRouterModelsResult, producerSettings } from '../api/__fixtures__/producer';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { SettingsPage } from './settings-page';
import type { RenderApiClient } from '../api/render-api-client';

function renderPage(client: Partial<RenderApiClient>) {
  const withDefaults: Partial<RenderApiClient> = {
    getProducerSettings: vi.fn().mockResolvedValue(producerSettings()),
    getOpenRouterModels: vi.fn().mockResolvedValue(openRouterModelsResult()),
    getElevenLabsSettings: vi.fn().mockResolvedValue({ keyConfigured: false, voices: [] }),
    getYouTubeIntegration: vi.fn().mockResolvedValue({ clientConfigured: false, connected: false, channel: null }),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

describe('SettingsPage', () => {
  it('shows the engine choice and each engine status', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
    expect((screen.getByLabelText('Engine') as HTMLSelectElement).value).toBe('auto');
    expect(screen.getByTestId('settings-engine-status-claudeCli').textContent).toContain('available');
    expect(screen.getByTestId('settings-engine-status-openrouter').textContent).toContain(
      'unavailable',
    );
  });

  it('explains why the Claude engine is not available', async () => {
    renderPage({
      getProducerSettings: vi.fn().mockResolvedValue(
        producerSettings({
          engines: {
            claudeCli: { available: false, reason: 'sign in the Claude Code CLI', models: [] },
            openrouter: { keyPresent: false, keyHint: null, models: [] },
          },
        }),
      ),
    });

    await waitFor(() =>
      expect(screen.getByTestId('settings-engine-status-claudeCli').textContent).toContain(
        'sign in the Claude Code CLI',
      ),
    );
  });

  it('offers the models of each engine for its default and saves the choice', async () => {
    const updateProducerSettings = vi.fn().mockResolvedValue(producerSettings({ engine: 'claude-cli' }));
    renderPage({ updateProducerSettings });

    await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Engine'), { target: { value: 'claude-cli' } });
    fireEvent.change(screen.getByLabelText('Default Claude model'), { target: { value: 'opus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateProducerSettings).toHaveBeenCalledWith({
        engine: 'claude-cli',
        models: { claude: 'opus', openrouter: 'anthropic/claude-haiku-4.5' },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('settings-producer-saved')).toBeTruthy());
  });

  it('shows the masked key with a hint when one is loaded, and lets it be replaced', async () => {
    renderPage({
      getProducerSettings: vi.fn().mockResolvedValue(
        producerSettings({
          engines: {
            claudeCli: { available: true, reason: null, models: [] },
            openrouter: { keyPresent: true, keyHint: '9abc', models: [] },
          },
        }),
      ),
    });

    await waitFor(() =>
      expect(screen.getByTestId('settings-key-loaded').textContent).toBe('Key loaded ••••9abc'),
      { timeout: 5000 },
    );
    expect(screen.queryByTestId('settings-key-form')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByTestId('settings-key-form')).toBeTruthy();
  });

  it('offers the key form directly when there is no key yet', async () => {
    renderPage({});

    await waitFor(() => expect(screen.getByTestId('settings-key-form')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Get a key at openrouter.ai/keys' }).getAttribute('href')).toBe(
      'https://openrouter.ai/keys',
    );
  });

  it('refuses a key that does not start with sk-or-v1- without calling the service', async () => {
    const putOpenRouterKey = vi.fn();
    renderPage({ putOpenRouterKey });

    await waitFor(() => expect(screen.getByTestId('settings-key-form')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('OpenRouter API key'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    expect(screen.getByRole('alert').textContent).toBe('Must start with sk-or-v1-');
    expect(putOpenRouterKey).not.toHaveBeenCalled();
  });

  it('sends the key once, then clears the field so it is never held or shown again', async () => {
    const putOpenRouterKey = vi.fn().mockResolvedValue({ keyPresent: true, keyHint: 'wxyz' });
    renderPage({ putOpenRouterKey });

    await waitFor(() => expect(screen.getByTestId('settings-key-form')).toBeTruthy());
    const input = screen.getByLabelText('OpenRouter API key') as HTMLInputElement;
    expect(input.type).toBe('password');

    fireEvent.change(input, { target: { value: 'sk-or-v1-abcdefghijklmnop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    expect(input.value).toBe('');
    await waitFor(() => expect(putOpenRouterKey).toHaveBeenCalledWith('sk-or-v1-abcdefghijklmnop'));
  });

  it('explains an invalid key answered by the service', async () => {
    const putOpenRouterKey = vi
      .fn()
      .mockRejectedValue(new RenderApiError('OPENROUTER_KEY_INVALID', 'rejected', 422, null));
    renderPage({ putOpenRouterKey });

    await waitFor(() => expect(screen.getByTestId('settings-key-form')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('OpenRouter API key'), {
      target: { value: 'sk-or-v1-abcdefghijklmnop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('OPENROUTER_KEY_INVALID'),
    );
  });

  it('removes the key only after an explicit confirmation', async () => {
    const deleteOpenRouterKey = vi.fn().mockResolvedValue({ keyPresent: false, keyHint: null });
    renderPage({
      getProducerSettings: vi.fn().mockResolvedValue(
        producerSettings({
          engines: {
            claudeCli: { available: true, reason: null, models: [] },
            openrouter: { keyPresent: true, keyHint: '9abc', models: [] },
          },
        }),
      ),
      deleteOpenRouterKey,
    });

    await waitFor(() => expect(screen.getByTestId('settings-key-loaded')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(deleteOpenRouterKey).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('settings-key-remove-accept'));

    await waitFor(() => expect(deleteOpenRouterKey).toHaveBeenCalledTimes(1));
  });

  describe('ElevenLabs voices', () => {
    const lucia = { id: 'abc123', label: 'Lucia', description: 'Warm' };

    it('loads the key and shows the plan the service reports', async () => {
      const putElevenLabsKey = vi.fn().mockResolvedValue({ keyConfigured: true, tier: 'creator' });
      const getElevenLabsSettings = vi
        .fn()
        .mockResolvedValueOnce({ keyConfigured: false, voices: [] })
        .mockResolvedValue({ keyConfigured: true, voices: [] });
      renderPage({ putElevenLabsKey, getElevenLabsSettings });

      await waitFor(() => expect(screen.getByTestId('settings-elevenlabs-key-form')).toBeTruthy());
      const input = screen.getByLabelText('ElevenLabs API key') as HTMLInputElement;
      expect(input.type).toBe('password');
      fireEvent.change(input, { target: { value: 'xi-secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save ElevenLabs key' }));

      await waitFor(() => expect(putElevenLabsKey).toHaveBeenCalledWith('xi-secret'));
      expect(input.value).toBe('');
      await waitFor(() =>
        expect(screen.getByTestId('settings-elevenlabs-key-loaded').textContent).toBe('Key loaded · creator plan'),
      );
    });

    it('shows the service message when ElevenLabs rejects the key', async () => {
      const putElevenLabsKey = vi
        .fn()
        .mockRejectedValue(new RenderApiError('VOICE_ENGINE_NOT_CONFIGURED', 'la key no es válida', 401, null));
      renderPage({ putElevenLabsKey });

      await waitFor(() => expect(screen.getByTestId('settings-elevenlabs-key-form')).toBeTruthy());
      fireEvent.change(screen.getByLabelText('ElevenLabs API key'), { target: { value: 'bad' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save ElevenLabs key' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert').map((node) => node.textContent ?? '');
        expect(alerts.some((text) => text.includes('VOICE_ENGINE_NOT_CONFIGURED') && text.includes('la key no es válida'))).toBe(true);
      });
    });

    it('adds a voice by id and name and saves the whole list', async () => {
      const putElevenLabsVoices = vi.fn().mockResolvedValue([lucia]);
      renderPage({ putElevenLabsVoices });

      await waitFor(() => expect(screen.getByLabelText('Voice ID')).toBeTruthy());
      fireEvent.change(screen.getByLabelText('Voice ID'), { target: { value: 'abc123' } });
      fireEvent.change(screen.getByLabelText('Voice name'), { target: { value: 'Lucia' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add voice' }));

      await waitFor(() =>
        expect(putElevenLabsVoices).toHaveBeenCalledWith([{ id: 'abc123', label: 'Lucia', description: '' }]),
      );
    });

    it('removes a voice and saves the remaining list', async () => {
      const putElevenLabsVoices = vi.fn().mockResolvedValue([]);
      renderPage({
        putElevenLabsVoices,
        getElevenLabsSettings: vi.fn().mockResolvedValue({ keyConfigured: true, voices: [lucia] }),
      });

      await waitFor(() => expect(screen.getByTestId('settings-elevenlabs-voices').textContent).toContain('abc123'));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Lucia' }));

      await waitFor(() => expect(putElevenLabsVoices).toHaveBeenCalledWith([]));
    });
  });
});
