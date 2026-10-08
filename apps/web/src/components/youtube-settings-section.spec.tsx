import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { YouTubeSettingsSection } from './youtube-settings-section';
import type { RenderApiClient } from '../api/render-api-client';
import type { YouTubeIntegration } from '../api/youtube-types';

const UNCONFIGURED: YouTubeIntegration = { clientConfigured: false, connected: false, channel: null };
const CONFIGURED: YouTubeIntegration = { clientConfigured: true, connected: false, channel: null };
const CONNECTED: YouTubeIntegration = {
  clientConfigured: true,
  connected: true,
  channel: { id: 'UC1', title: 'My Channel', thumbnailUrl: 'https://img.example/avatar.png' },
};

function renderSection(client: Partial<RenderApiClient>) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <YouTubeSettingsSection />
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('YouTubeSettingsSection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('asks for the client credential first and saves it with a masked secret', async () => {
    const putYouTubeClient = vi.fn().mockResolvedValue(CONFIGURED);
    const getYouTubeIntegration = vi.fn().mockResolvedValueOnce(UNCONFIGURED).mockResolvedValue(CONFIGURED);
    renderSection({ getYouTubeIntegration, putYouTubeClient });

    await waitFor(() => expect(screen.getByTestId('youtube-client-form')).toBeTruthy());
    expect(screen.getByLabelText('Client secret').getAttribute('type')).toBe('password');
    const save = screen.getByRole('button', { name: 'Save credential' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: ' id-123 ' } });
    fireEvent.change(screen.getByLabelText('Client secret'), { target: { value: 'secret-456' } });
    fireEvent.click(save);

    await waitFor(() =>
      expect(putYouTubeClient).toHaveBeenCalledWith({ clientId: 'id-123', clientSecret: 'secret-456' }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect with YouTube' })).toBeTruthy());
    expect(screen.queryByTestId('youtube-client-form')).toBeNull();
  });

  it('links to the guide anchor and to the Google credentials page', async () => {
    renderSection({ getYouTubeIntegration: vi.fn().mockResolvedValue(UNCONFIGURED) });

    await waitFor(() => expect(screen.getByTestId('youtube-client-form')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Step by step in the guide' }).getAttribute('href')).toBe(
      '/guide#youtube',
    );
    expect(screen.getByRole('link', { name: 'Open Google Cloud credentials' }).getAttribute('target')).toBe(
      '_blank',
    );
  });

  it('opens the consent page and polls every 2 seconds until the channel shows up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const connectYouTube = vi.fn().mockResolvedValue({ authUrl: 'https://accounts.google.com/o/oauth2/auth?x=1' });
    const getYouTubeIntegration = vi
      .fn()
      .mockResolvedValueOnce(CONFIGURED)
      .mockResolvedValueOnce(CONFIGURED)
      .mockResolvedValue(CONNECTED);
    renderSection({ getYouTubeIntegration, connectYouTube });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect with YouTube' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Connect with YouTube' }));

    await waitFor(() => expect(screen.getByTestId('youtube-connect-waiting')).toBeTruthy());
    expect(open).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/auth?x=1', '_blank', 'noopener');
    expect(screen.getByRole('link', { name: 'Open the Google sign-in page again' }).getAttribute('href')).toBe(
      'https://accounts.google.com/o/oauth2/auth?x=1',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getYouTubeIntegration).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('youtube-connect-waiting')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(screen.getByTestId('youtube-connected')).toBeTruthy());
    expect(screen.getByText('My Channel')).toBeTruthy();
    expect(screen.getByAltText('My Channel').getAttribute('src')).toBe('https://img.example/avatar.png');
  });

  it('stops waiting when cancelled', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const connectYouTube = vi.fn().mockResolvedValue({ authUrl: 'https://accounts.google.com/x' });
    renderSection({ getYouTubeIntegration: vi.fn().mockResolvedValue(CONFIGURED), connectYouTube });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect with YouTube' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Connect with YouTube' }));
    await waitFor(() => expect(screen.getByTestId('youtube-connect-waiting')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('youtube-connect-waiting')).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect with YouTube' })).toBeTruthy();
  });

  it('disconnects only after the confirmation modal', async () => {
    const disconnectYouTube = vi.fn().mockResolvedValue(undefined);
    const getYouTubeIntegration = vi.fn().mockResolvedValueOnce(CONNECTED).mockResolvedValue(CONFIGURED);
    renderSection({ getYouTubeIntegration, disconnectYouTube });

    await waitFor(() => expect(screen.getByTestId('youtube-connected')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(screen.getByTestId('youtube-disconnect-modal')).toBeTruthy();
    expect(disconnectYouTube).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('youtube-disconnect-accept'));

    await waitFor(() => expect(disconnectYouTube).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect with YouTube' })).toBeTruthy());
    expect(screen.queryByTestId('youtube-disconnect-modal')).toBeNull();
  });

  it('lets the credential be replaced from the connected state', async () => {
    renderSection({ getYouTubeIntegration: vi.fn().mockResolvedValue(CONNECTED) });

    await waitFor(() => expect(screen.getByTestId('youtube-connected')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Change credential' }));

    expect(screen.getByTestId('youtube-client-form')).toBeTruthy();
  });
});
