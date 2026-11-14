export type ThemePreference = 'system' | 'light' | 'dark';
export type MaterialPreference = 'glass' | 'solid';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vm-theme';
export const MATERIAL_STORAGE_KEY = 'vm-material';
export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const MATERIAL_PREFERENCES: readonly MaterialPreference[] = ['glass', 'solid'];

export function parseThemePreference(raw: string | null): ThemePreference {
  return THEME_PREFERENCES.find((candidate) => candidate === raw) ?? 'system';
}

export function parseMaterialPreference(raw: string | null): MaterialPreference {
  return MATERIAL_PREFERENCES.find((candidate) => candidate === raw) ?? 'glass';
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_SCHEME_QUERY).matches;
}

export function applyThemeToDocument(resolved: ResolvedTheme, material: MaterialPreference): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-theme', resolved);
  if (material === 'solid') root.setAttribute('data-material', 'solid');
  else root.removeAttribute('data-material');
}
