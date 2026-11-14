import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { GuidePage } from './guide-page';
import { GUIDE_EN } from '../guide/guide-content-en';
import { GUIDE_ES } from '../guide/guide-content-es';
import { LANGUAGE_STORAGE_KEY } from '../i18n/language';
import { LanguageProvider } from '../i18n/language-context';

function renderGuide() {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <GuidePage />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('GuidePage', () => {
  it('explains every section of the studio in english when that is the chosen language', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide')).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GUIDE_EN.title);
    expect(
      screen.getAllByTestId('guide-section').map((node) => node.dataset['guideSection']),
    ).toEqual(GUIDE_EN.sections.map((section) => section.id));
  });

  it('opens in spanish by default, with nothing stored', async () => {
    renderGuide();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GUIDE_ES.title),
    );
    expect(screen.getByTestId('guide').dataset['guideLanguage']).toBe('es');
  });

  it('reads the very same sections in spanish when that is the language', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    renderGuide();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(GUIDE_ES.title),
    );
    expect(screen.getByTestId('guide').dataset['guideLanguage']).toBe('es');
    expect(
      screen.getAllByTestId('guide-section').map((node) => node.dataset['guideSection']),
    ).toEqual(GUIDE_ES.sections.map((section) => section.id));
  });

  it('offers an index that jumps to every section', async () => {
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide-index')).toBeTruthy());
    const links = Array.from(screen.getByTestId('guide-index').querySelectorAll('a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      GUIDE_EN.sections.map((section) => `#${section.id}`),
    );
  });

  it('draws the preset tables with the markdown the producer already speaks', async () => {
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide')).toBeTruthy());
    const presets = screen.getByTestId('guide').querySelector('[data-guide-section="presets"]');

    expect(presets?.querySelectorAll('table')).toHaveLength(1);
    expect(presets?.textContent).toContain('youtube-16x9');
  });

  it('says what the library roles decide before anything is uploaded', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide')).toBeTruthy());
    const library = screen.getByTestId('guide').querySelector('[data-guide-section="library"]');

    expect(library?.textContent).toContain('raw/aroll/');
    expect(library?.textContent).toContain('at least three times');
  });

  it('numbers every index entry and marks the first section as the current one', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide-index')).toBeTruthy());
    const links = Array.from(screen.getByTestId('guide-index').querySelectorAll('a'));

    expect(links[0]?.textContent).toBe(`1${GUIDE_EN.sections[0]?.title}`);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(
      links.map((_, index) => (index === 0 ? 'location' : null)),
    );
    expect(screen.getByRole('navigation', { name: 'In this guide' })).toBe(screen.getByTestId('guide-index'));
  });

  it('moves the current mark to the section picked in the index', async () => {
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide-index')).toBeTruthy());
    const links = Array.from(screen.getByTestId('guide-index').querySelectorAll('a'));
    fireEvent.click(links[2] as HTMLElement);

    expect(links[2]?.getAttribute('aria-current')).toBe('location');
    expect(links[0]?.getAttribute('aria-current')).toBeNull();
  });

  it('labels each section with its position in the guide', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderGuide();

    await waitFor(() => expect(screen.getByTestId('guide')).toBeTruthy());
    const sections = screen.getAllByTestId('guide-section');

    expect(sections[0]?.textContent).toContain(`Step 1 of ${GUIDE_EN.sections.length}`);
    expect(sections[sections.length - 1]?.textContent).toContain(
      `Step ${GUIDE_EN.sections.length} of ${GUIDE_EN.sections.length}`,
    );
  });
});
