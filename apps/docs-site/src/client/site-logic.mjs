export const THEME_STORAGE_KEY = 'vm-theme';

export const LOCALE_STORAGE_KEY = 'vm-locale';

export const SUPPORTED_THEMES = ['light', 'dark'];

export const SUPPORTED_LOCALES = ['es', 'en'];

export function parseStoredTheme(rawValue) {
  return SUPPORTED_THEMES.includes(rawValue) ? rawValue : null;
}

export function parseStoredLocale(rawValue) {
  return SUPPORTED_LOCALES.includes(rawValue) ? rawValue : null;
}

export function resolveEffectiveTheme(storedTheme, systemPrefersDark) {
  const parsed = parseStoredTheme(storedTheme);
  if (parsed !== null) {
    return parsed;
  }
  return systemPrefersDark ? 'dark' : 'light';
}

export function oppositeTheme(effectiveTheme) {
  return effectiveTheme === 'dark' ? 'light' : 'dark';
}

export function localeRedirectTarget(storedLocale, pageLocale, alternates) {
  const preferred = parseStoredLocale(storedLocale);
  if (preferred === null || preferred === pageLocale) {
    return null;
  }
  const match = alternates.find((alternate) => alternate.hreflang === preferred);
  return match === undefined ? null : match.href;
}

export function clampStepIndex(index, total) {
  if (total <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), total - 1);
}

export function stepIndexAfterMove(currentIndex, delta, total) {
  return clampStepIndex(currentIndex + delta, total);
}

export function tabIndexForKey(key, currentIndex, total) {
  if (total <= 0) {
    return null;
  }
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (currentIndex + 1) % total;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (currentIndex - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

export function formatStepStatus(template, currentIndex, total) {
  return template.replace('{current}', String(currentIndex + 1)).replace('{total}', String(total));
}

export function readStorage(storage, key) {
  try {
    return storage === null || storage === undefined ? null : storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(storage, key, value) {
  try {
    if (storage !== null && storage !== undefined) {
      storage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}
