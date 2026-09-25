import { describe, expect, it } from 'vitest';

import { inboxReasonKey } from './inbox';
import { INBOX_PROPOSAL_REASONS } from './render-api-types';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';

describe('inboxReasonKey', () => {
  it('points every proposal reason at a translation key both catalogs carry', () => {
    for (const reason of INBOX_PROPOSAL_REASONS) {
      const key = inboxReasonKey(reason);
      expect(MESSAGES_EN[key]).toBeTruthy();
      expect(MESSAGES_ES[key]).toBeTruthy();
    }
  });
});
