import type { Language } from '../../i18n/language';

export type Localized = {
  es: string;
  en: string;
};

export type InlinePart = string | { text: string; href: string } | { code: string };

export type ContentBlock =
  | { kind: 'paragraph'; parts: readonly InlinePart[] }
  | { kind: 'list'; items: readonly (readonly InlinePart[])[] }
  | { kind: 'code'; text: string };

export type ProseSection = {
  id: string;
  title: string;
  blocks: readonly ContentBlock[];
};

export type ProseContent = {
  title: string;
  lede: string;
  sections: readonly ProseSection[];
};

export const REQUIREMENT_IDS = [
  'media-local',
  'composition-remotion/render',
  'ffmpeg',
  'ffprobe',
  'whisperCli',
  'whisperModel',
  'ttsCli',
  'ttsVoicesDir',
  'claudeCli',
  'openrouter',
] as const;

export type RequirementId = (typeof REQUIREMENT_IDS)[number];

export type RequirementCopy = {
  label: string;
  purpose: string;
  fix: string;
};

export type RequirementGroupId = 'engine' | 'media' | 'producer';

export type RequirementsContent = {
  title: string;
  lede: string;
  groups: Readonly<Record<RequirementGroupId, string>>;
  producerNote: string;
  items: Readonly<Record<RequirementId, RequirementCopy>>;
};

export type LicensesContent = {
  title: string;
  lede: string;
  ownCodeTitle: string;
  ownCode: readonly InlinePart[];
  remotionTitle: string;
  remotion: readonly InlinePart[];
  noticesTitle: string;
  notices: readonly InlinePart[];
  inventoryTitle: string;
  inventoryLede: string;
};

export type AboutContent = {
  requirements: RequirementsContent;
  licenses: LicensesContent;
  openSource: ProseContent;
  privacy: ProseContent;
};

export const REPO_URL = 'https://github.com/e-burgos/video-maker';
export const REPO_LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;
export const REPO_NOTICES_URL = `${REPO_URL}/blob/main/apps/desktop/vendor/THIRD_PARTY_NOTICES.md`;
export const REMOTION_LICENSE_URL = 'https://www.remotion.dev/license';

export async function loadAboutContent(language: Language): Promise<AboutContent> {
  if (language === 'es') {
    return (await import('./about-content-es')).ABOUT_ES;
  }
  return (await import('./about-content-en')).ABOUT_EN;
}
