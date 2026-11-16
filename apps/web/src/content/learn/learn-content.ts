import type { Language } from '../../i18n/language';

export type LearnScreenshot = {
  file: string;
  alt: string;
};

export type PipelineStage = {
  id: string;
  title: string;
  text: string;
};

export type PathStep = {
  title: string;
  text: string;
  screenshot: LearnScreenshot;
};

export type CreationPath = {
  id: string;
  tabLabel: string;
  title: string;
  intro: string;
  steps: readonly PathStep[];
};

export type WhereRow = {
  stage: string;
  where: string;
  with: string;
};

export type HowItWorksContent = {
  title: string;
  lede: string;
  pipelineTitle: string;
  stages: readonly PipelineStage[];
  pathsTitle: string;
  pathsLede: string;
  paths: readonly CreationPath[];
  whereTitle: string;
  whereHeaders: readonly [string, string, string];
  whereRows: readonly WhereRow[];
};

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type FaqContent = {
  title: string;
  entries: readonly FaqEntry[];
};

export type GalleryShot = {
  file: string;
  caption: string;
};

export type GalleryContent = {
  title: string;
  lede: string;
  shots: readonly GalleryShot[];
};

export type TutorialContent = {
  title: string;
  lede: string;
  credit: string;
};

export type LearnContent = {
  howItWorks: HowItWorksContent;
  tutorial: TutorialContent;
  faq: FaqContent;
  gallery: GalleryContent;
};

export const TUTORIAL_VIDEO_URL = 'https://video.estebanburgos.com.ar/tutoriales/Tutorial-Video-Maker.mp4';

export const TUTORIAL_POSTER_FILE = 'learn/tutorial-poster.jpg';

export const GALLERY_DIRECTORY = 'gallery';

export function galleryImageUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${GALLERY_DIRECTORY}/${file}`;
}

export function tutorialPosterUrl(): string {
  return `${import.meta.env.BASE_URL}${TUTORIAL_POSTER_FILE}`;
}

export async function loadLearnContent(language: Language): Promise<LearnContent> {
  if (language === 'es') {
    return (await import('./learn-content-es')).LEARN_ES;
  }
  return (await import('./learn-content-en')).LEARN_EN;
}
