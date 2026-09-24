export const DEFAULT_LOCALE = 'es' as const;

export interface MenuStrings {
  readonly preferences: string;
  readonly projectsFolder: string;
  readonly help: string;
  readonly openLogsFolder: string;
  readonly aboutLicenses: string;
}

const MENU_STRINGS_ES: MenuStrings = {
  preferences: 'Preferencias',
  projectsFolder: 'Carpeta de proyectos…',
  help: 'Ayuda',
  openLogsFolder: 'Abrir carpeta de logs',
  aboutLicenses: 'Acerca de / Licencias',
};

export function menuStrings(): MenuStrings {
  return MENU_STRINGS_ES;
}
