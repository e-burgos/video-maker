import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from './language';
import { LanguageProvider, loadMessages, useLanguage, useT, useTn } from './language-context';
import { MESSAGES_EN } from './messages-en';

function Probe() {
  const t = useT();
  const { language } = useLanguage();
  return (
    <span data-testid="probe" data-language={language}>
      {t('health.ok', { cycle: 3 })}
    </span>
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useT outside a provider', () => {
  it('renders english so any component works on its own', () => {
    render(<Probe />);

    expect(screen.getByTestId('probe').textContent).toBe('Ready');
    expect(screen.getByTestId('probe').dataset['language']).toBe('en');
  });
});

describe('LanguageProvider', () => {
  it('opens in the stored language and loads its catalog', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('probe').dataset['language']).toBe('es');
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('Listo'),
    );
  });

  it('never shows a raw key while the spanish catalog is still loading', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('probe').textContent).toBe('Ready');
  });

  it('stamps the active language on the document for assistive technology', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    await waitFor(() => expect(document.documentElement.lang).toBe('es'));
  });

  it('opens a spanish browser in spanish with nothing stored', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-AR', 'en-US']);

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe('Listo'),
    );
  });
});

describe('useTn', () => {
  function PluralProbe({ count }: { count: number }) {
    const tn = useTn();
    return <span data-testid="plural">{tn('library.assetCount', count)}</span>;
  }

  it('agrees the count with the sentence in the active language', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

    render(
      <LanguageProvider>
        <PluralProbe count={1} />
      </LanguageProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('plural').textContent).toBe('1 asset crudo'));
  });

  it('uses the plural variant for anything that is not one', () => {
    render(<PluralProbe count={4} />);

    expect(screen.getByTestId('plural').textContent).toBe('4 raw assets');
  });
});

describe('loadMessages', () => {
  it('answers the english catalog without loading a second chunk', async () => {
    expect(await loadMessages('en')).toBe(MESSAGES_EN);
  });

  it('loads the spanish catalog lazily, out of the initial chunk', async () => {
    const spanish = await loadMessages('es');

    expect(spanish['projects.title']).toBe('Tus videos');
    expect(spanish).not.toBe(MESSAGES_EN);
  });
});
