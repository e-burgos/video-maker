import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { openRouterModelsResult, producerSettings } from '../api/__fixtures__/producer';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { ShellToolbar } from '../components/shell/shell-toolbar';
import { ToolbarActionProvider } from '../components/shell/toolbar-action-provider';
import { ThemeProvider } from '../theme/theme-context';
import { SettingsPage } from './settings-page';
import type { RenderApiClient } from '../api/render-api-client';

function renderPage(client: Partial<RenderApiClient>, tab = 'producer') {
  const withDefaults: Partial<RenderApiClient> = {
    getProducerSettings: vi.fn().mockResolvedValue(producerSettings()),
    getOpenRouterModels: vi.fn().mockResolvedValue(openRouterModelsResult()),
    getElevenLabsSettings: vi.fn().mockResolvedValue({ keyConfigured: false, voices: [] }),
    getYouTubeIntegration: vi.fn().mockResolvedValue({ clientConfigured: false, connected: false, channel: null }),
    ...client,
  };

  render(
    <ThemeProvider>
      <RenderApiProvider client={withDefaults as RenderApiClient}>
        <MemoryRouter initialEntries={[`/settings?tab=${tab}`]}>
          <ToolbarActionProvider>
            <ShellToolbar title="Settings" subtitle={null} />
            <SettingsPage />
          </ToolbarActionProvider>
        </MemoryRouter>
      </RenderApiProvider>
    </ThemeProvider>,
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
      renderPage({ putElevenLabsKey, getElevenLabsSettings }, 'voice');

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
      renderPage({ putElevenLabsKey }, 'voice');

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
      renderPage({ putElevenLabsVoices }, 'voice');

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
      renderPage(
        {
          putElevenLabsVoices,
          getElevenLabsSettings: vi.fn().mockResolvedValue({ keyConfigured: true, voices: [lucia] }),
        },
        'voice',
      );

      await waitFor(() => expect(screen.getByTestId('settings-elevenlabs-voices').textContent).toContain('abc123'));
      fireEvent.click(screen.getByRole('button', { name: 'Remove Lucia' }));

      await waitFor(() => expect(putElevenLabsVoices).toHaveBeenCalledWith([]));
    });
  });
  describe('tabs in the url', () => {
    function visiblePanels(): string[] {
      return screen
        .getAllByRole('tabpanel', { hidden: true })
        .filter((panel) => !panel.hasAttribute('hidden'))
        .map((panel) => panel.getAttribute('data-testid') ?? '');
    }

    it('opens the producer tab when the url names no tab', async () => {
      renderPage({}, '');

      await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
      expect(visiblePanels()).toEqual(['settings-panel-producer']);
      expect(screen.getByRole('tab', { name: 'Producer' }).getAttribute('aria-selected')).toBe('true');
    });

    it.each([
      ['voice', 'settings-panel-voice'],
      ['youtube', 'settings-panel-youtube'],
      ['appearance', 'settings-panel-appearance'],
    ])('opens only the %s panel when the url says ?tab=%s', async (tab, panel) => {
      renderPage({}, tab);

      await waitFor(() => expect(visiblePanels()).toEqual([panel]));
    });

    it('falls back to the producer tab for an unknown tab', async () => {
      renderPage({}, 'nope');

      await waitFor(() => expect(visiblePanels()).toEqual(['settings-panel-producer']));
    });

    it('switches panel when another tab is picked', async () => {
      renderPage({});

      await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
      fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

      await waitFor(() => expect(visiblePanels()).toEqual(['settings-panel-appearance']));
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Solid' })).toBeTruthy();
    });
  });

  describe('unsaved changes', () => {
    it('marks the producer tab and enables the toolbar action only while its draft differs from the saved one', async () => {
      const updateProducerSettings = vi.fn().mockResolvedValue(producerSettings({ engine: 'claude-cli' }));
      renderPage({ updateProducerSettings });

      await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
      const toolbarSave = screen.getByTestId('toolbar-action') as HTMLButtonElement;
      expect(toolbarSave.textContent).toBe('Save changes');
      expect(toolbarSave.disabled).toBe(true);
      expect(screen.getByTestId('settings-tab-producer').getAttribute('data-changed')).toBeNull();

      fireEvent.change(screen.getByLabelText('Engine'), { target: { value: 'claude-cli' } });

      await waitFor(() => expect((screen.getByTestId('toolbar-action') as HTMLButtonElement).disabled).toBe(false));
      expect(screen.getByTestId('settings-producer-unsaved')).toBeTruthy();
      expect(screen.getByTestId('settings-tab-producer').textContent).toContain('Unsaved changes in this tab');
      expect(screen.getByTestId('settings-tab-youtube').textContent).not.toContain('Unsaved');
    });

    it('saves the pending draft from the toolbar action and clears the marks', async () => {
      const updateProducerSettings = vi.fn().mockResolvedValue(producerSettings({ engine: 'claude-cli' }));
      const getProducerSettings = vi
        .fn()
        .mockResolvedValueOnce(producerSettings())
        .mockResolvedValue(producerSettings({ engine: 'claude-cli' }));
      renderPage({ updateProducerSettings, getProducerSettings });

      await waitFor(() => expect(screen.getByTestId('settings-producer-section')).toBeTruthy());
      fireEvent.change(screen.getByLabelText('Engine'), { target: { value: 'claude-cli' } });
      await waitFor(() => expect((screen.getByTestId('toolbar-action') as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(screen.getByTestId('toolbar-action'));

      await waitFor(() => expect(updateProducerSettings).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('settings-producer-saved')).toBeTruthy());
      expect(screen.queryByTestId('settings-producer-unsaved')).toBeNull();
      expect((screen.getByTestId('toolbar-action') as HTMLButtonElement).disabled).toBe(true);
    });

    it('marks the YouTube tab when a playlist mapping is edited and not saved', async () => {
      renderPage(
        {
          getYouTubeIntegration: vi.fn().mockResolvedValue({
            clientConfigured: true,
            connected: true,
            channel: { id: 'UC1', title: 'My Channel', thumbnailUrl: null },
          }),
          getOrganization: vi.fn().mockResolvedValue({ folders: [], videos: {} }),
          listYouTubePlaylists: vi.fn().mockResolvedValue([{ id: 'PL1', title: 'List one' }]),
          getCategoryPlaylists: vi.fn().mockResolvedValue({ categoryPlaylists: {}, generalPlaylistId: null }),
        },
        'youtube',
      );

      await waitFor(() => expect(screen.getByLabelText('General playlist')).toBeTruthy());
      expect(screen.getByTestId('settings-tab-youtube').textContent).not.toContain('Unsaved');

      fireEvent.change(screen.getByLabelText('General playlist'), { target: { value: 'PL1' } });

      await waitFor(() =>
        expect(screen.getByTestId('settings-tab-youtube').textContent).toContain('Unsaved changes in this tab'),
      );
      expect(screen.getByTestId('youtube-category-playlists-unsaved')).toBeTruthy();
    });
  });
});
