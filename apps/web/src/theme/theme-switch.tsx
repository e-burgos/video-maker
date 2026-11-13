import { SegmentedControl } from '@e-burgos/tucu-ui';

import { useT } from '../i18n/language-context';
import { useThemePreferences } from './theme-context';
import type { MaterialPreference, ThemePreference } from './theme-preferences';

export function ThemeSwitch() {
  const t = useT();
  const { theme, material, setTheme, setMaterial } = useThemePreferences();

  const themeOptions = [
    { value: 'system', label: t('theme.system') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];
  const materialOptions = [
    { value: 'glass', label: t('material.glass') },
    { value: 'solid', label: t('material.solid') },
  ];

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label={t('theme.label')}
        options={themeOptions}
        value={theme}
        onChange={(next) => setTheme(next as ThemePreference)}
      />
      <SegmentedControl
        label={t('material.label')}
        options={materialOptions}
        value={material}
        onChange={(next) => setMaterial(next as MaterialPreference)}
      />
      <p className="text-xs opacity-70">{t('material.hint')}</p>
    </div>
  );
}
