import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { MESSAGES_EN } from './messages-en';
import type { Messages, TranslationKey } from './messages-en';
import { detectLanguage, storeLanguage } from './language';
import type { Language } from './language';
import { translate, translatePlural } from './translate';
import type { PluralKey, TranslationParams } from './translate';

export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export type TranslatePluralFn = (
  key: PluralKey,
  count: number,
  params?: TranslationParams,
) => string;

export type LanguageState = {
  language: Language;
  messages: Messages;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageState>({
  language: 'en',
  messages: MESSAGES_EN,
  setLanguage: () => undefined,
});

export async function loadMessages(language: Language): Promise<Messages> {
  if (language === 'en') {
    return MESSAGES_EN;
  }
  return (await import('./messages-es')).MESSAGES_ES;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(detectLanguage);
  const [messages, setMessages] = useState<Messages>(MESSAGES_EN);

  useEffect(() => {
    let subscribed = true;
    void loadMessages(language).then((loaded) => {
      if (subscribed) {
        setMessages(loaded);
      }
    });
    return () => {
      subscribed = false;
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    storeLanguage(next);
    setCurrentLanguage(next);
  }, []);

  const value = useMemo<LanguageState>(
    () => ({ language, messages, setLanguage }),
    [language, messages, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

export function useT(): TranslateFn {
  const { messages } = useContext(LanguageContext);
  return useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(messages, key, params),
    [messages],
  );
}

export function useTn(): TranslatePluralFn {
  const { messages } = useContext(LanguageContext);
  return useCallback(
    (key: PluralKey, count: number, params?: TranslationParams) =>
      translatePlural(messages, key, count, params),
    [messages],
  );
}
