import type { StateBadgeTone } from '@e-burgos/tucu-ui';

import type { AppUpdateStatus } from '../../api/render-api-types';
import type { TranslationKey } from '../../i18n/messages-en';

export const UPDATE_BADGE_TONE: Readonly<Record<AppUpdateStatus, StateBadgeTone>> = {
  'up-to-date': 'green',
  available: 'teal',
  unknown: 'neutral',
};

export const UPDATE_BADGE_LABEL: Readonly<Record<AppUpdateStatus, TranslationKey>> = {
  'up-to-date': 'about.update.badge.upToDate',
  available: 'about.update.badge.available',
  unknown: 'about.update.badge.unknown',
};

export function isSafeDownloadUrl(url: string | undefined): url is string {
  return url !== undefined && /^https?:\/\//i.test(url);
}

export function formatPublishedDate(iso: string | undefined, locale: string): string | null {
  if (iso === undefined) {
    return null;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}
