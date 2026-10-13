import type { ProjectMode } from './render-api-types';
import type { TranslationKey } from '../i18n/messages-en';

export type ReferenceSuggestionReason = 'name' | 'request' | 'mode';

const REFERENCE_NAME = /referen|ejemplo|example|inspira|como[-_ ]?este|modelo/i;
const LIKE_THIS_REQUEST =
  /\b(un|otro|uno)\s+video\s+(como|igual|parecido|similar)\s+(a\s+)?(este|esto|ese)\b|\b(como|igual que|parecido a|similar a)\s+(este|esta)\s+(video|clip)\b|\bvideo\s+como\s+(este|ese)\b|\bvideo like this\b|\blike this (video|one)\b|\bsame style as this\b/i;

const REASON_KEY: Readonly<Record<ReferenceSuggestionReason, TranslationKey>> = {
  name: 'assetRole.reference.suggested.name',
  request: 'assetRole.reference.suggested.request',
  mode: 'assetRole.reference.suggested.mode',
};

export function referenceSuggestionReasonKey(reason: ReferenceSuggestionReason): TranslationKey {
  return REASON_KEY[reason];
}

export function suggestReferenceReason(input: {
  fileName: string;
  kind: string;
  mode?: ProjectMode;
  requestText?: string;
}): ReferenceSuggestionReason | null {
  if (input.kind !== 'video') {
    return null;
  }
  if (REFERENCE_NAME.test(input.fileName)) {
    return 'name';
  }
  if (input.requestText !== undefined && LIKE_THIS_REQUEST.test(input.requestText)) {
    return 'request';
  }
  if (input.mode === 'motion') {
    return 'mode';
  }
  return null;
}
