import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../../../api/render-api-context';
import type { RenderApiClient } from '../../../api/render-api-client';
import { RenderApiError } from '../../../api/render-api-error';
import type { FreeMediaResult, FreeMusicResult } from '../../../api/render-api-types';
import { LANGUAGE_STORAGE_KEY } from '../../../i18n/language';
import { LanguageProvider } from '../../../i18n/language-context';
import { FreeMediaPanel } from './free-media-panel';
import type { FreeMediaTab } from './free-media-model';

const IMAGE: FreeMediaResult = {
  resultId: 'img-1',
  source: 'commons',
  kind: 'image',
  title: 'Solar eclipse 2024',
  license: 'CC BY-SA 4.0',
  author: 'Ana Pérez',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Eclipse.jpg',
  durationMs: null,
  width: 4000,
  height: 3000,
};

const TRACK: FreeMusicResult = {
  resultId: 'trk-1',
  source: 'openverse',
  title: 'Calm morning',
  license: 'CC BY 4.0',
  author: 'Luis',
  pageUrl: 'https://openverse.org/audio/1',
  durationMs: 95000,
};

function renderPanel(client: Partial<RenderApiClient>, options: { tabs?: readonly FreeMediaTab[]; onImported?: () => void } = {}) {
  render(
    <LanguageProvider>
      <RenderApiProvider client={client as unknown as RenderApiClient}>
        <FreeMediaPanel
          slug="demo"
          tabs={options.tabs ?? ['image', 'video', 'music']}
          onImported={options.onImported ?? vi.fn()}
          onClose={vi.fn()}
        />
      </RenderApiProvider>
    </LanguageProvider>,
  );
}

function search(text: string) {
  fireEvent.change(screen.getByTestId('free-media-query'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('free-media-search'));
}

beforeEach(() => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
});

afterEach(() => {
  window.localStorage.clear();
});

describe('FreeMediaPanel', () => {
  it('starts with a hint and keeps search disabled until there is text', () => {
    renderPanel({});

    expect(screen.getByText(/Search Wikimedia Commons/)).toBeTruthy();
    expect((screen.getByTestId('free-media-search') as HTMLButtonElement).disabled).toBe(true);
  });

  it('searches images and shows source, license and credit', async () => {
    const searchFreeMedia = vi.fn().mockResolvedValue([IMAGE]);
    renderPanel({ searchFreeMedia });

    search('eclipse');

    await waitFor(() => expect(screen.getByTestId('free-media-result')).toBeTruthy());
    expect(searchFreeMedia).toHaveBeenCalledWith({ slug: 'demo', query: 'eclipse', kind: 'image', maxResults: 10 });
    const card = screen.getByTestId('free-media-result').textContent ?? '';
    expect(card).toContain('Wikimedia Commons');
    expect(card).toContain('CC BY-SA 4.0');
    expect(card).toContain('Ana Pérez');
    expect(card).toContain('4000×3000');
  });

  it('says so when nothing matches', async () => {
    renderPanel({ searchFreeMedia: vi.fn().mockResolvedValue([]) });

    search('zzzz');

    await waitFor(() => expect(screen.getByTestId('free-media-empty').textContent).toContain('No results'));
  });

  it('shows the error and retries the same search', async () => {
    const searchFreeMedia = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('MEDIA_SOURCE_UNAVAILABLE', 'no source', 502, null))
      .mockResolvedValue([IMAGE]);
    renderPanel({ searchFreeMedia });

    search('eclipse');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('MEDIA_SOURCE_UNAVAILABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByTestId('free-media-result')).toBeTruthy());
    expect(searchFreeMedia).toHaveBeenCalledTimes(2);
  });

  it('imports a result into its role and refreshes the library', async () => {
    const importFreeMedia = vi.fn().mockResolvedValue({ path: 'raw/images/eclipse.jpg', credit: {} });
    const onImported = vi.fn();
    renderPanel({ searchFreeMedia: vi.fn().mockResolvedValue([IMAGE]), importFreeMedia }, { onImported });
    search('eclipse');
    await waitFor(() => expect(screen.getByTestId('free-media-import')).toBeTruthy());

    expect(screen.getByTestId('free-media-import').textContent).toBe('Import as Images');
    fireEvent.click(screen.getByTestId('free-media-import'));

    await waitFor(() => expect(screen.getByTestId('free-media-import').textContent).toBe('Imported'));
    expect(importFreeMedia).toHaveBeenCalledWith('demo', 'img-1');
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it('keeps the result importable when the import fails', async () => {
    const importFreeMedia = vi.fn().mockRejectedValue(new RenderApiError('MEDIA_RESULT_UNKNOWN', 'expired', 404, null));
    const onImported = vi.fn();
    renderPanel({ searchFreeMedia: vi.fn().mockResolvedValue([IMAGE]), importFreeMedia }, { onImported });
    search('eclipse');
    await waitFor(() => expect(screen.getByTestId('free-media-import')).toBeTruthy());

    fireEvent.click(screen.getByTestId('free-media-import'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('MEDIA_RESULT_UNKNOWN'));
    expect((screen.getByTestId('free-media-import') as HTMLButtonElement).disabled).toBe(false);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('searches music by mood and imports it as music', async () => {
    const searchFreeMusic = vi.fn().mockResolvedValue([TRACK]);
    const importFreeMusic = vi.fn().mockResolvedValue({ path: 'raw/audio/calm.mp3', credit: {} });
    renderPanel({ searchFreeMusic, importFreeMusic });

    fireEvent.click(screen.getByTestId('free-media-tab-music'));
    search('calm');
    await waitFor(() => expect(screen.getByTestId('free-media-result')).toBeTruthy());

    expect(searchFreeMusic).toHaveBeenCalledWith({ slug: 'demo', mood: 'calm', maxResults: 10 });
    expect(screen.getByTestId('free-media-result').textContent).toContain('1:35');
    expect(screen.getByTestId('free-media-import').textContent).toBe('Import as Music');
    fireEvent.click(screen.getByTestId('free-media-import'));
    await waitFor(() => expect(importFreeMusic).toHaveBeenCalledWith('demo', 'trk-1'));
  });

  it('drops the previous results when the tab changes', async () => {
    renderPanel({ searchFreeMedia: vi.fn().mockResolvedValue([IMAGE]) });
    search('eclipse');
    await waitFor(() => expect(screen.getByTestId('free-media-result')).toBeTruthy());

    fireEvent.click(screen.getByTestId('free-media-tab-video'));

    await waitFor(() => expect(screen.queryByTestId('free-media-result')).toBeNull());
  });

  it('offers only images when the project is a motion video', () => {
    renderPanel({}, { tabs: ['image'] });

    expect(screen.getByTestId('free-media-tab-image')).toBeTruthy();
    expect(screen.queryByTestId('free-media-tab-music')).toBeNull();
  });
});
