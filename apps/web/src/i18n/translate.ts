import { MESSAGES_EN } from './messages-en';
import type { Messages, TranslationKey } from './messages-en';

export type TranslationParams = Readonly<Record<string, string | number>>;

type PluralBaseOf<Key> = Key extends `${infer Base}.one` ? Base : never;

export type PluralKey = PluralBaseOf<TranslationKey>;

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/gu;

export function interpolate(template: string, params: TranslationParams = {}): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function translate(
  messages: Messages,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = messages[key] ?? MESSAGES_EN[key] ?? key;
  return interpolate(template, params);
}

export function translatePlural(
  messages: Messages,
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  const variant = (count === 1 ? `${key}.one` : `${key}.other`) as TranslationKey;
  return translate(messages, variant, { count, ...params });
}
