import type { TranslationKey } from '../../i18n/messages-en';

export const SETTINGS_TABS = ['producer', 'voice', 'youtube', 'appearance'] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TABS_ID_BASE = 'settings-tabs';

export const SETTINGS_TAB_LABEL: Readonly<Record<SettingsTab, TranslationKey>> = {
  producer: 'settings.tab.producer',
  voice: 'settings.tab.voice',
  youtube: 'settings.tab.youtube',
  appearance: 'settings.tab.appearance',
};
