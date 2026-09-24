import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from '../i18n/language';
import { LanguageProvider, useT } from '../i18n/language-context';
import { LanguageSwitch } from './language-switch';

function Probe() {
  const t = useT();
  return <span data-testid="probe">{t('projects.title')}</span>;
}

function renderSwitch() {
  return render(
    <LanguageProvider>
      <LanguageSwitch />
      <Probe />
    </LanguageProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('LanguageSwitch', () => {
  it('offers one focusable button per language, named in words for a screen reader', () => {
    renderSwitch();

    const group = screen.getByRole('group', { name: 'Interface language' });
    const buttons = Array.from(group.querySelectorAll('button'));

    expect(buttons.map((button) => button.dataset['language'])).toEqual(['en', 'es']);
    expect(screen.getByRole('button', { name: 'English' }).tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: 'Spanish' }).getAttribute('title')).toBe('Spanish');
  });

  it('marks the active language as pressed and nothing else (spanish by default)', () => {
    renderSwitch();

    expect(screen.getByRole('button', { name: 'Spanish' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('translates the whole tree the moment spanish is chosen', async () => {
    renderSwitch();

    expect(screen.getByTestId('probe').textContent).toBe('Projects');

    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('Proyectos'));
    expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('persists the choice so the next visit opens in the same language', async () => {
    renderSwitch();

    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));

    await waitFor(() => expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es'));
  });

  it('goes back to english from spanish', async () => {
    renderSwitch();

    fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('Proyectos'));

    fireEvent.click(screen.getByRole('button', { name: 'Inglés' }));

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('Projects'));
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
