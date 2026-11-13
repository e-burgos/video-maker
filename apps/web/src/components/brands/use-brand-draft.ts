import type { BrandEditor } from '../../hooks/use-brand-editor';
import { useSectionDraft } from '../../hooks/use-section-draft';
import type { SectionDraft } from '../../hooks/use-section-draft';
import type { TranslationKey } from '../../i18n/messages-en';
import {
  DRAFT_SECTION_IDS,
  applyBrandDraft,
  devicesOf,
  draftInvalidity,
  identityOf,
  musicOf,
  photosOf,
  typographyOf,
  voiceOf,
} from './brand-draft';
import type { BrandDraftValues, DirtySections, DraftSectionId } from './brand-draft';

export type BrandDraft = {
  identity: SectionDraft<BrandDraftValues['identity']>;
  typography: SectionDraft<BrandDraftValues['typography']>;
  voice: SectionDraft<BrandDraftValues['voice']>;
  music: SectionDraft<BrandDraftValues['music']>;
  photos: SectionDraft<BrandDraftValues['photos']>;
  devices: SectionDraft<BrandDraftValues['devices']>;
  dirtyBySection: DirtySections;
  dirtySections: readonly DraftSectionId[];
  dirty: boolean;
  invalidKey: TranslationKey | null;
  save: () => void;
  discard: () => void;
};

export function useBrandDraft(editor: BrandEditor): BrandDraft {
  const manifest = editor.manifest;
  const identity = useSectionDraft(identityOf(manifest));
  const typography = useSectionDraft(typographyOf(manifest));
  const voice = useSectionDraft(voiceOf(manifest));
  const music = useSectionDraft(musicOf(manifest));
  const photos = useSectionDraft(photosOf(manifest));
  const devices = useSectionDraft(devicesOf(manifest));

  const dirtyBySection: DirtySections = {
    identity: identity.dirty,
    typography: typography.dirty,
    voice: voice.dirty,
    music: music.dirty,
    photos: photos.dirty,
    devices: devices.dirty,
  };
  const dirtySections = DRAFT_SECTION_IDS.filter((id) => dirtyBySection[id]);
  const values: BrandDraftValues = {
    identity: identity.draft,
    typography: typography.draft,
    voice: voice.draft,
    music: music.draft,
    photos: photos.draft,
    devices: devices.draft,
  };

  function save(): void {
    void editor.update((current) => applyBrandDraft(current, values, dirtyBySection));
  }

  function discard(): void {
    identity.setDraft(identityOf(manifest));
    typography.setDraft(typographyOf(manifest));
    voice.setDraft(voiceOf(manifest));
    music.setDraft(musicOf(manifest));
    photos.setDraft(photosOf(manifest));
    devices.setDraft(devicesOf(manifest));
  }

  return {
    identity,
    typography,
    voice,
    music,
    photos,
    devices,
    dirtyBySection,
    dirtySections,
    dirty: dirtySections.length > 0,
    invalidKey: draftInvalidity(values, dirtyBySection),
    save,
    discard,
  };
}
