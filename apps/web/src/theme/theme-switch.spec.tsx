import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from './theme-context';
import { ThemeSwitch } from './theme-switch';

function renderSwitch() {
  return render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-material');
});

describe('ThemeSwitch', () => {
  it('exposes both selectors with catalog labels', () => {
    renderSwitch();
    expect(screen.getByRole('radiogroup', { name: 'Interface theme' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Surface material' })).toBeTruthy();
    ['System', 'Light', 'Dark', 'Glass', 'Solid'].forEach((name) =>
      expect(screen.getByRole('radio', { name })).toBeTruthy(),
    );
  });

  it('marks the defaults as selected', () => {
    renderSwitch();
    expect(screen.getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Glass' }).getAttribute('aria-checked')).toBe('true');
  });

  it('changes theme and material and persists them', () => {
    renderSwitch();
    act(() => screen.getByRole('radio', { name: 'Dark' }).click());
    act(() => screen.getByRole('radio', { name: 'Solid' }).click());
    expect(window.localStorage.getItem('vm-theme')).toBe('dark');
    expect(window.localStorage.getItem('vm-material')).toBe('solid');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-material')).toBe('solid');
  });
});
