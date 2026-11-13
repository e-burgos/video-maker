import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  DARK_SCHEME_QUERY,
  MATERIAL_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  parseMaterialPreference,
  parseThemePreference,
  readStoredValue,
  resolveTheme,
  systemPrefersDark,
  writeStoredValue,
} from './theme-preferences';
import type { MaterialPreference, ResolvedTheme, ThemePreference } from './theme-preferences';

export type ThemeState = {
  theme: ThemePreference;
  material: MaterialPreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  setMaterial: (material: MaterialPreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersDark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(() => parseThemePreference(readStoredValue(THEME_STORAGE_KEY)));
  const [material, setMaterialState] = useState(() =>
    parseMaterialPreference(readStoredValue(MATERIAL_STORAGE_KEY)),
  );
  const prefersDark = useSystemPrefersDark();
  const resolvedTheme = resolveTheme(theme, prefersDark);

  useEffect(() => {
    applyThemeToDocument(resolvedTheme, material);
  }, [resolvedTheme, material]);

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      material,
      resolvedTheme,
      setTheme: (next) => {
        setThemeState(next);
        writeStoredValue(THEME_STORAGE_KEY, next);
      },
      setMaterial: (next) => {
        setMaterialState(next);
        writeStoredValue(MATERIAL_STORAGE_KEY, next);
      },
    }),
    [theme, material, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreferences(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useThemePreferences must be used within a ThemeProvider');
  return state;
}
