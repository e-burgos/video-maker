import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import indexHtml from '../../index.html?raw';
import { ThemeProvider, useThemePreferences } from './theme-context';
import { applyThemeToDocument, resolveTheme } from './theme-preferences';

type SchemeListener = (event: MediaQueryListEvent) => void;

function mockColorScheme(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<SchemeListener>();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: SchemeListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: SchemeListener) => listeners.delete(listener),
  }));
  return (next: boolean) => {
    dark = next;
    listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
  };
}

function Probe() {
  const { theme, material, resolvedTheme, setTheme, setMaterial } = useThemePreferences();
  return (
    <div>
      <output data-testid="state">{`${theme}|${material}|${resolvedTheme}`}</output>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
      <button onClick={() => setMaterial('solid')}>solid</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

function state() {
  return screen.getByTestId('state').textContent;
}

function click(name: string) {
  act(() => screen.getByRole('button', { name }).click());
}

const root = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root.className = '';
  root.removeAttribute('data-theme');
  root.removeAttribute('data-material');
});

afterEach(() => vi.restoreAllMocks());

describe('ThemeProvider', () => {
  it('defaults to system theme and glass material', () => {
    mockColorScheme(false);
    renderProbe();
    expect(state()).toBe('system|glass|light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.hasAttribute('data-material')).toBe(false);
  });

  it('follows prefers-color-scheme while the theme is system', () => {
    const setSystemDark = mockColorScheme(false);
    renderProbe();
    act(() => setSystemDark(true));
    expect(state()).toBe('system|glass|dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores the system scheme once a theme is chosen', () => {
    const setSystemDark = mockColorScheme(false);
    renderProbe();
    click('light');
    act(() => setSystemDark(true));
    expect(state()).toBe('light|glass|light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('persists the choices and marks solid material on the root', () => {
    mockColorScheme(false);
    renderProbe();
    click('dark');
    click('solid');
    expect(window.localStorage.getItem('vm-theme')).toBe('dark');
    expect(window.localStorage.getItem('vm-material')).toBe('solid');
    expect(root.getAttribute('data-material')).toBe('solid');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('restores stored choices and discards invalid ones', () => {
    mockColorScheme(false);
    window.localStorage.setItem('vm-theme', 'dark');
    window.localStorage.setItem('vm-material', 'plastic');
    renderProbe();
    expect(state()).toBe('dark|glass|dark');
  });

  it('survives a throwing localStorage', () => {
    mockColorScheme(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderProbe();
    expect(state()).toBe('system|glass|dark');
    click('light');
    expect(state()).toBe('light|glass|light');
  });
});

function runBootScript() {
  const source = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? '';
  new Function(source)();
}

function rootSnapshot() {
  return {
    dark: root.classList.contains('dark'),
    theme: root.getAttribute('data-theme'),
    material: root.getAttribute('data-material'),
  };
}

describe('boot script in index.html', () => {
  const combinations = [
    ['system', 'glass', false],
    ['system', 'solid', true],
    ['light', 'glass', true],
    ['dark', 'solid', false],
    [null, null, true],
  ] as const;

  it.each(combinations)('matches the provider for theme=%s material=%s systemDark=%s', (theme, material, dark) => {
    mockColorScheme(dark);
    if (theme) window.localStorage.setItem('vm-theme', theme);
    if (material) window.localStorage.setItem('vm-material', material);

    runBootScript();
    const fromScript = rootSnapshot();

    root.className = '';
    root.removeAttribute('data-theme');
    root.removeAttribute('data-material');
    applyThemeToDocument(resolveTheme((theme ?? 'system') as never, dark), (material ?? 'glass') as never);

    expect(fromScript).toEqual(rootSnapshot());
  });

  it.each([
    ['Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Electron/33.0.0 Safari/537.36', 'electron'],
    ['Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', null],
  ])('marks data-shell only for Electron user agents (%s)', (userAgent, expected) => {
    mockColorScheme(false);
    root.removeAttribute('data-shell');
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);

    runBootScript();

    expect(root.getAttribute('data-shell')).toBe(expected);
    root.removeAttribute('data-shell');
  });

  it('does not throw when localStorage throws', () => {
    mockColorScheme(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(runBootScript).not.toThrow();
    expect(root.classList.contains('dark')).toBe(true);
  });
});
