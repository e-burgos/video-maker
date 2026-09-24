import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, menuStrings } from './menu-strings';

describe('menuStrings', () => {
  it('is spanish end to end, matching the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('es');
    const strings = menuStrings();

    expect(strings).toEqual({
      preferences: 'Preferencias',
      projectsFolder: 'Carpeta de proyectos…',
      help: 'Ayuda',
      openLogsFolder: 'Abrir carpeta de logs',
      aboutLicenses: 'Acerca de / Licencias',
    });
  });
});
