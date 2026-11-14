import { useT } from '../../i18n/language-context';
import { ThemeSwitch } from '../../theme/theme-switch';
import { SettingsPanel } from './settings-panel';

export function AppearanceSection() {
  const t = useT();

  return (
    <SettingsPanel
      testId="settings-appearance-section"
      heading={t('settings.appearance.heading')}
      description={t('settings.appearance.description')}
    >
      <ThemeSwitch headings />
    </SettingsPanel>
  );
}
