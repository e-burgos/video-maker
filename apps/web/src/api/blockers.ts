import type { TranslationKey } from '../i18n/messages-en';
import type { TranslationParams } from '../i18n/translate';

export type Blocker = {
  key: TranslationKey;
  params?: TranslationParams;
};

export function blockerId(blocker: Blocker): string {
  const params = blocker.params ?? {};
  const flattened = Object.keys(params)
    .sort()
    .map((name) => `${name}=${String(params[name])}`)
    .join('&');
  return flattened === '' ? blocker.key : `${blocker.key}?${flattened}`;
}
