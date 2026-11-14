import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';
import type { AppUpdate, ServiceHealth } from '../api/render-api-types';
import { ABOUT_TABS } from '../components/about/about-tabs';
import { ShellToolbar } from '../components/shell/shell-toolbar';
import { ToolbarActionProvider } from '../components/shell/toolbar-action-provider';
import { ABOUT_EN } from '../content/about/about-content-en';
import { ABOUT_ES } from '../content/about/about-content-es';
import { LANGUAGE_STORAGE_KEY } from '../i18n/language';
import { LanguageProvider } from '../i18n/language-context';
import { AboutPage } from './about-page';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{`${pathname}${search}`}</p>;
}

const BINARIES = ['ffmpeg', 'ffprobe', 'whisperCli', 'whisperModel', 'ttsCli', 'ttsVoicesDir'];

function health(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 3,
    version: '0.3.2',
    time: '2026-11-13T00:00:00.000Z',
    engine: [
      { name: 'media-local', loaded: true },
      { name: 'composition-remotion/render', loaded: true },
    ],
    binaries: BINARIES.map((name) => ({ name, envVar: `${name}_PATH`, resolved: true })),
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
      producerEngines: { claudeCli: true, openrouter: false },
    },
    jobs: { running: 0, queued: 0 },
    ...overrides,
  };
}

function renderAbout(entry: string, client: Partial<RenderApiClient>) {
  const full = { getHealth: vi.fn().mockResolvedValue(health()), ...client } as unknown as RenderApiClient;
  render(
    <LanguageProvider>
      <RenderApiProvider client={full}>
        <ToolbarActionProvider>
          <MemoryRouter initialEntries={[entry]}>
            <ShellToolbar title="About" subtitle={null} />
            <Routes>
              <Route path="/about" element={<AboutPage />} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </ToolbarActionProvider>
      </RenderApiProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
});

afterEach(() => {
  window.localStorage.clear();
});

describe('AboutPage', () => {
  it('offers the five tabs and opens on the installed version from the service', async () => {
    renderAbout('/about', {});

    for (const tab of ABOUT_TABS) {
      expect(screen.getByTestId(`about-tab-${tab}`)).toBeTruthy();
    }
    await waitFor(() => expect(screen.getByTestId('about-installed-version').textContent).toBe('0.3.2'));
  });

  it('keeps the chosen tab in the url', async () => {
    renderAbout('/about', {});

    fireEvent.click(screen.getByTestId('about-tab-privacy'));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/about?tab=privacy'));
    await waitFor(() => expect(screen.getByTestId('about-privacy')).toBeTruthy());
  });

  describe('update check', () => {
    function updateClient(update: () => Promise<AppUpdate>) {
      return { getAppUpdate: vi.fn(update) };
    }

    it('declares the single toolbar action and starts idle', async () => {
      renderAbout('/about', updateClient(async () => ({ status: 'up-to-date', installedVersion: '0.3.2' })));

      expect(screen.getByRole('button', { name: 'Check for updates' })).toBeTruthy();
      expect(screen.queryByTestId('about-update-result')).toBeNull();
    });

    it('reports an up-to-date installation', async () => {
      const client = updateClient(async () => ({ status: 'up-to-date', installedVersion: '0.3.2', latestVersion: '0.3.2' }));
      renderAbout('/about', client);

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      await waitFor(() => expect(screen.getByTestId('about-update-result').dataset['status']).toBe('up-to-date'));
      expect(screen.getByTestId('about-update-result').textContent).toContain('You have the latest version.');
      expect(client.getAppUpdate).toHaveBeenCalledTimes(1);
    });

    it('offers an external download link when an update is available', async () => {
      renderAbout(
        '/about',
        updateClient(async () => ({
          status: 'available',
          installedVersion: '0.3.2',
          latestVersion: '0.4.0',
          downloadUrl: 'https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg',
          publishedAt: '2026-11-13T12:00:00.000Z',
        })),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      const link = await screen.findByTestId('about-update-download');
      expect(link.getAttribute('href')).toBe('https://video.estebanburgos.com.ar/descargas/Video-Maker-arm64.dmg');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(screen.getByTestId('about-update-result').textContent).toContain('0.4.0');
    });

    it('never renders a download link with an unsafe url', async () => {
      renderAbout(
        '/about',
        updateClient(async () => ({ status: 'available', installedVersion: '0.3.2', latestVersion: '0.4.0', downloadUrl: 'javascript:alert(1)' })),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      await waitFor(() => expect(screen.getByTestId('about-update-result').dataset['status']).toBe('available'));
      expect(screen.queryByTestId('about-update-download')).toBeNull();
    });

    it('says it could not check when the status is unknown', async () => {
      renderAbout('/about', updateClient(async () => ({ status: 'unknown', installedVersion: '0.3.2' })));

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      await waitFor(() => expect(screen.getByTestId('about-update-result').dataset['status']).toBe('unknown'));
      expect(screen.getByTestId('about-update-result').textContent).toContain('could not check');
    });

    it('treats a failed request as unknown without breaking the page', async () => {
      renderAbout('/about', updateClient(async () => Promise.reject(new Error('offline'))));

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      await waitFor(() => expect(screen.getByTestId('about-update-result').dataset['status']).toBe('unknown'));
      expect(screen.getByTestId('about-installed-version').textContent).toBe('0.3.2');
    });

    it('goes back to the version tab when the action runs from another tab', async () => {
      renderAbout('/about?tab=licenses', updateClient(async () => ({ status: 'up-to-date', installedVersion: '0.3.2' })));

      fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/about?tab=version'));
      await screen.findByTestId('about-update-result');
    });
  });

  describe('requirements', () => {
    it('lists every requirement with its state and a way to fix it', async () => {
      renderAbout('/about?tab=requirements', {});

      await waitFor(() => expect(screen.getAllByTestId('about-requirement')).toHaveLength(10));
      const ffmpeg = screen.getAllByTestId('about-requirement').find((row) => row.dataset['requirementId'] === 'ffmpeg');
      expect(ffmpeg?.dataset['state']).toBe('ok');
      expect(ffmpeg?.textContent).toContain('ffmpeg_PATH');
      expect(ffmpeg?.textContent).toContain('How to fix it');
      expect(screen.getByTestId('about-requirements-summary').textContent).toContain('meets every requirement');
    });

    it('flags what is missing and says how many', async () => {
      const broken = health({
        binaries: BINARIES.map((name) => ({ name, envVar: `${name}_PATH`, resolved: name !== 'whisperModel' })),
      });
      renderAbout('/about?tab=requirements', { getHealth: vi.fn().mockResolvedValue(broken) });

      await waitFor(() => expect(screen.getAllByTestId('about-requirement')).toHaveLength(10));
      const model = screen.getAllByTestId('about-requirement').find((row) => row.dataset['requirementId'] === 'whisperModel');
      expect(model?.dataset['state']).toBe('missing');
      expect(screen.getByTestId('about-requirements-summary').textContent).toContain('Missing requirements: 1.');
    });

    it('shows the second producer engine as optional', async () => {
      renderAbout('/about?tab=requirements', {});

      await waitFor(() => expect(screen.getAllByTestId('about-requirement')).toHaveLength(10));
      const openrouter = screen.getAllByTestId('about-requirement').find((row) => row.dataset['requirementId'] === 'openrouter');
      expect(openrouter?.dataset['state']).toBe('optional');
    });

    it('offers a retry when the service does not answer', async () => {
      const getHealth = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(health());
      renderAbout('/about?tab=requirements', { getHealth });

      await waitFor(() => expect(screen.getByTestId('about-requirements-unavailable')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(screen.getAllByTestId('about-requirement')).toHaveLength(10));
    });
  });

  describe('licenses, open source and privacy', () => {
    it('shows the technology inventory grouped by category', async () => {
      renderAbout('/about?tab=licenses', {});

      await waitFor(() => expect(screen.getAllByTestId('about-tech-category')).toHaveLength(6));
      const remotion = screen.getAllByTestId('about-tech-item').find((item) => item.dataset['techId'] === 'remotion');
      expect(remotion?.textContent).toContain('Remotion License');
      expect(remotion?.textContent).toContain('4.0.522');
    });

    it('describes the MIT license and links to the repository in the open source tab', async () => {
      renderAbout('/about?tab=open-source', {});

      await waitFor(() => expect(screen.getByTestId('about-open-source')).toBeTruthy());
      const link = screen.getAllByRole('link', { name: 'github.com/e-burgos/video-maker' })[0];
      expect(link?.getAttribute('href')).toBe('https://github.com/e-burgos/video-maker');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(screen.getByTestId('about-open-source-license').textContent).toContain('MIT');
    });

    it('renders the privacy policy in spanish when the language is spanish', async () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
      renderAbout('/about?tab=privacy', {});

      await waitFor(() => expect(screen.getByTestId('about-privacy-youtube')).toBeTruthy());
      expect(screen.getByTestId('about-privacy-youtube').textContent).toContain('Conexión con YouTube');
    });
  });
});

describe('about content parity', () => {
  it('has the same sections and requirements in both languages', () => {
    expect(ABOUT_ES.openSource.sections.map((section) => section.id)).toEqual(
      ABOUT_EN.openSource.sections.map((section) => section.id),
    );
    expect(ABOUT_ES.privacy.sections.map((section) => section.id)).toEqual(
      ABOUT_EN.privacy.sections.map((section) => section.id),
    );
    expect(Object.keys(ABOUT_ES.requirements.items)).toEqual(Object.keys(ABOUT_EN.requirements.items));
  });
});
