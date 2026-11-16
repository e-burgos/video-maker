import type { TranslationKey } from '../../i18n/messages-en';
import type { DraftSectionId } from './brand-draft';

export type BrandSectionId = 'identity' | 'logo' | 'colors' | 'typography' | 'voice' | 'music' | 'photos' | 'devices';

export const BRAND_SECTIONS: readonly { id: BrandSectionId; labelKey: TranslationKey }[] = [
  { id: 'identity', labelKey: 'brands.section.identity' },
  { id: 'logo', labelKey: 'brands.section.logo' },
  { id: 'colors', labelKey: 'brands.section.colors' },
  { id: 'typography', labelKey: 'brands.section.typography' },
  { id: 'voice', labelKey: 'brands.section.voice' },
  { id: 'music', labelKey: 'brands.section.music' },
  { id: 'photos', labelKey: 'brands.section.photos' },
  { id: 'devices', labelKey: 'brands.section.devices' },
];

export function sectionLabelKey(id: BrandSectionId): TranslationKey {
  return BRAND_SECTIONS.find((section) => section.id === id)?.labelKey ?? 'brands.section.identity';
}

export function isDraftSection(id: BrandSectionId): id is DraftSectionId {
  return id !== 'logo' && id !== 'colors';
}
