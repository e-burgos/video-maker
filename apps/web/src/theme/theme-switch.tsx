import { SegmentedControl } from '@e-burgos/tucu-ui';

import { useT } from '../i18n/language-context';
import { useThemePreferences } from './theme-context';
import type { MaterialPreference, ThemePreference } from './theme-preferences';

const SEGMENTED_FRAME_CLASS =
  'h-10 rounded-[10px] border border-[var(--tucu-glass-sub-line)] bg-[var(--tucu-glass-sub-bg)] p-[3px] [&_[data-tucu=segmented-control]]:h-full [&_[data-tucu=segmented-control-track]]:h-full [&_[data-tucu=segmented-control-track]]:w-full [&_[data-tucu=segmented-control-track]]:border-0 [&_[data-tucu=segmented-control-track]]:bg-transparent [&_[data-tucu=segmented-control-track]]:p-0 [&_[role=radio]]:h-full';

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
    <div className="flex flex-col gap-2">
      <div className={SEGMENTED_FRAME_CLASS}>
        <SegmentedControl
          label={t('theme.label')}
          size="xs"
          fullWidth
          options={themeOptions}
          value={theme}
          onChange={(next) => setTheme(next as ThemePreference)}
        />
      </div>
      <div className={SEGMENTED_FRAME_CLASS}>
        <SegmentedControl
          label={t('material.label')}
          size="xs"
          fullWidth
          options={materialOptions}
          value={material}
          onChange={(next) => setMaterial(next as MaterialPreference)}
        />
      </div>
      <p className="text-xs opacity-70">{t('material.hint')}</p>
    </div>
  );
}
