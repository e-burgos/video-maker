import type { BadgeTone } from '../components/ui/badge';
import type { TranslationKey } from '../i18n/messages-en';
import type { PublicationStatus } from './render-api-types';

export const PUBLICATION_STATUS_LABEL: Readonly<Record<PublicationStatus, TranslationKey>> = {
  uploading: 'publications.status.uploading',
  published: 'publications.status.published',
  scheduled: 'publications.status.scheduled',
  failed: 'publications.status.failed',
};

export const PUBLICATION_STATUS_TONE: Readonly<Record<PublicationStatus, BadgeTone>> = {
  uploading: 'warning',
  published: 'success',
  scheduled: 'accent',
  failed: 'danger',
};
