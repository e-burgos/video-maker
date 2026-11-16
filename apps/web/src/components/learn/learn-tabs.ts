import type { TranslationKey } from '../../i18n/messages-en';

export const LEARN_TABS = ['guide', 'how-it-works', 'tutorial', 'faq', 'gallery'] as const;

export type LearnTab = (typeof LEARN_TABS)[number];

export const LEARN_TABS_ID_BASE = 'learn-tabs';

export const LEARN_TAB_LABEL: Readonly<Record<LearnTab, TranslationKey>> = {
  guide: 'learn.tab.guide',
  'how-it-works': 'learn.tab.howItWorks',
  tutorial: 'learn.tab.tutorial',
  faq: 'learn.tab.faq',
  gallery: 'learn.tab.gallery',
};
