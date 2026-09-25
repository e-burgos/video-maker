import type { InboxProposalReason } from './render-api-types';
import type { TranslationKey } from '../i18n/messages-en';

const REASON_KEY: Readonly<Record<InboxProposalReason, TranslationKey>> = {
  'has-audio': 'inbox.reason.hasAudio',
  'no-audio': 'inbox.reason.noAudio',
  'alpha-channel': 'inbox.reason.alphaChannel',
  image: 'inbox.reason.image',
  'long-audio': 'inbox.reason.longAudio',
  'voice-name-hint': 'inbox.reason.voiceNameHint',
  'music-name-hint': 'inbox.reason.musicNameHint',
  'short-audio': 'inbox.reason.shortAudio',
};

export function inboxReasonKey(reason: InboxProposalReason): TranslationKey {
  return REASON_KEY[reason];
}
