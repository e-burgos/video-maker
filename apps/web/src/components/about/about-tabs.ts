import type { TranslationKey } from '../../i18n/messages-en';

export const ABOUT_TABS = ['version', 'requirements', 'licenses', 'open-source', 'privacy'] as const;

export type AboutTab = (typeof ABOUT_TABS)[number];

export const ABOUT_TABS_ID_BASE = 'about-tabs';

export const ABOUT_TAB_LABEL: Readonly<Record<AboutTab, TranslationKey>> = {
  version: 'about.tab.version',
  requirements: 'about.tab.requirements',
  licenses: 'about.tab.licenses',
  'open-source': 'about.tab.openSource',
  privacy: 'about.tab.privacy',
};

export const REQUIREMENTS_PATH = `/about?tab=${'requirements' satisfies AboutTab}`;
