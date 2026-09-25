import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
  messages: Messages | null;
  setLanguage: (language: Language) => void;
};

// The full catalogs are lazy (see loadMessages): the eager bundle carries neither.
// A synchronous English catalog is still needed for the very first paint (before the
// dynamic import below resolves) and for the hundreds of component tests that render
// without a <LanguageProvider>; test-setup.ts preloads it via preloadFallbackMessages.
let fallbackMessages: Messages | null = null;

export async function preloadFallbackMessages(): Promise<void> {
  fallbackMessages = (await import('./messages-en')).MESSAGES_EN;
}

function activeMessages(messages: Messages | null): Messages {
  return messages ?? fallbackMessages ?? ({} as Messages);
}

const LanguageContext = createContext<LanguageState>({
  language: 'en',
  messages: null,
  setLanguage: () => undefined,
});

export async function loadMessages(language: Language): Promise<Messages> {
  return language === 'en'
    ? (await import('./messages-en')).MESSAGES_EN
    : (await import('./messages-es')).MESSAGES_ES;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(detectLanguage);
  const [messages, setMessages] = useState<Messages | null>(null);

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
  const active = activeMessages(messages);
  return useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(active, key, params),
    [active],
  );
}

export function useTn(): TranslatePluralFn {
  const { messages } = useContext(LanguageContext);
  const active = activeMessages(messages);
  return useCallback(
    (key: PluralKey, count: number, params?: TranslationParams) =>
      translatePlural(active, key, count, params),
    [active],
  );
}
