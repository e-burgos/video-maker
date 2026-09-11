import type { Language } from '../i18n/language';

export type GuideSection = {
  id: string;
  title: string;
  body: string;
};

export type GuideContent = {
  title: string;
  intro: string;
  sections: readonly GuideSection[];
};

export async function loadGuideContent(language: Language): Promise<GuideContent> {
  if (language === 'es') {
    return (await import('./guide-content-es')).GUIDE_ES;
  }
  return (await import('./guide-content-en')).GUIDE_EN;
}
