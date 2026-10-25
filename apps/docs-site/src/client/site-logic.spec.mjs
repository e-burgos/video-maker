import { describe, expect, it } from 'vitest';

import {
  clampStepIndex,
  formatStepStatus,
  localeRedirectTarget,
  oppositeTheme,
  readStorage,
  resolveEffectiveTheme,
  stepIndexAfterMove,
  tabIndexForKey,
  writeStorage,
} from './site-logic.mjs';

const ALTERNATES = [
  { hreflang: 'es', href: 'https://example.test/tecnologia/' },
  { hreflang: 'en', href: 'https://example.test/en/technology/' },
  { hreflang: 'x-default', href: 'https://example.test/tecnologia/' },
];

describe('theme', () => {
  it('prefers the stored theme and falls back to the system preference', () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
    expect(resolveEffectiveTheme(null, true)).toBe('dark');
    expect(resolveEffectiveTheme('sepia', false)).toBe('light');
  });

  it('toggles to the opposite theme', () => {
    expect(oppositeTheme('dark')).toBe('light');
    expect(oppositeTheme('light')).toBe('dark');
  });
});

describe('locale redirect', () => {
  it('redirects only when the visitor stored a different supported locale', () => {
    expect(localeRedirectTarget('en', 'es', ALTERNATES)).toBe('https://example.test/en/technology/');
    expect(localeRedirectTarget('es', 'es', ALTERNATES)).toBeNull();
    expect(localeRedirectTarget(null, 'es', ALTERNATES)).toBeNull();
    expect(localeRedirectTarget('fr', 'es', ALTERNATES)).toBeNull();
    expect(localeRedirectTarget('en', 'es', [])).toBeNull();
  });
});

describe('stepper and tabs', () => {
  it('clamps step moves inside the range', () => {
    expect(clampStepIndex(-2, 4)).toBe(0);
    expect(clampStepIndex(9, 4)).toBe(3);
    expect(clampStepIndex(1, 0)).toBe(0);
    expect(stepIndexAfterMove(3, 1, 4)).toBe(3);
    expect(stepIndexAfterMove(0, -1, 4)).toBe(0);
    expect(stepIndexAfterMove(1, 1, 4)).toBe(2);
  });

  it('cycles tabs with the arrow keys and jumps with Home/End', () => {
    expect(tabIndexForKey('ArrowRight', 1, 2)).toBe(0);
    expect(tabIndexForKey('ArrowLeft', 0, 2)).toBe(1);
    expect(tabIndexForKey('Home', 1, 2)).toBe(0);
    expect(tabIndexForKey('End', 0, 3)).toBe(2);
    expect(tabIndexForKey('Enter', 0, 2)).toBeNull();
    expect(tabIndexForKey('ArrowRight', 0, 0)).toBeNull();
  });

  it('formats the step status from a localized template', () => {
    expect(formatStepStatus('Paso {current} de {total}', 0, 4)).toBe('Paso 1 de 4');
    expect(formatStepStatus('Step {current} of {total}', 3, 5)).toBe('Step 4 of 5');
  });
});

describe('storage', () => {
  it('survives a missing or throwing storage', () => {
    const throwing = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(readStorage(null, 'vm-theme')).toBeNull();
    expect(readStorage(throwing, 'vm-theme')).toBeNull();
    expect(writeStorage(throwing, 'vm-theme', 'dark')).toBe(false);
  });

  it('reads and writes through a working storage', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    expect(writeStorage(storage, 'vm-locale', 'en')).toBe(true);
    expect(readStorage(storage, 'vm-locale')).toBe('en');
  });
});
