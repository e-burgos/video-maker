import { imagesOf, rowsOf } from '../../api/brand-photo-rows';
import type { PhotoRow } from '../../api/brand-photo-rows';
import { withOptionalText, fontFamilies } from '../../api/brand-manifest-edit';
import type {
  BrandDevices,
  BrandManifest,
  BrandTrack,
  BrandTypography,
  BrandVoice,
} from '../../api/brand-types';
import type { TranslationKey } from '../../i18n/messages-en';

export type DraftSectionId = 'identity' | 'typography' | 'voice' | 'music' | 'photos' | 'devices';

export type IdentityDraft = { name: string; spokenName: string; tagline: string; url: string };
export type TypographyDraft = { display: string; body: string; mono: string };

export type BrandDraftValues = {
  identity: IdentityDraft;
  typography: TypographyDraft;
  voice: BrandVoice;
  music: BrandTrack[];
  photos: PhotoRow[];
  devices: BrandDevices;
};

export type DirtySections = Readonly<Record<DraftSectionId, boolean>>;

export const DRAFT_SECTION_IDS: readonly DraftSectionId[] = [
  'identity',
  'typography',
  'voice',
  'music',
  'photos',
  'devices',
];

export function identityOf(manifest: BrandManifest | null): IdentityDraft {
  return {
    name: manifest?.name ?? '',
    spokenName: manifest?.spokenName ?? '',
    tagline: manifest?.tagline ?? '',
    url: manifest?.url ?? '',
  };
}

export function typographyOf(manifest: BrandManifest | null): TypographyDraft {
  const families = manifest === null ? [] : fontFamilies(manifest);
  return {
    display: manifest?.typography?.display ?? families[0] ?? '',
    body: manifest?.typography?.body ?? families[0] ?? '',
    mono: manifest?.typography?.mono ?? '',
  };
}

export function voiceOf(manifest: BrandManifest | null): BrandVoice {
  return { id: manifest?.voice.id ?? '', lengthScale: manifest?.voice.lengthScale ?? 1 };
}

export function musicOf(manifest: BrandManifest | null): BrandTrack[] {
  return manifest?.music ?? [];
}

export function photosOf(manifest: BrandManifest | null): PhotoRow[] {
  return rowsOf(manifest?.images ?? {});
}

export function devicesOf(manifest: BrandManifest | null): BrandDevices {
  return manifest?.devices ?? {};
}

export function trackIsComplete(track: BrandTrack): boolean {
  return track.credit.trim() !== '' && track.mood.trim() !== '' && track.bpm > 0;
}

function normalizedTrack(track: BrandTrack): BrandTrack {
  const { drop, ...rest } = track;
  return {
    ...rest,
    credit: track.credit.trim(),
    mood: track.mood.trim(),
    ...(drop === undefined ? {} : { drop }),
  };
}

function typographyOfDraft(draft: TypographyDraft): BrandTypography {
  return draft.mono === ''
    ? { display: draft.display, body: draft.body }
    : { display: draft.display, body: draft.body, mono: draft.mono };
}

export function applyBrandDraft(current: BrandManifest, values: BrandDraftValues, dirty: DirtySections): BrandManifest {
  let next = current;
  if (dirty.identity) {
    next = withOptionalText(
      {
        ...next,
        name: values.identity.name.trim(),
        spokenName: values.identity.spokenName.trim(),
        tagline: values.identity.tagline.trim(),
      },
      'url',
      values.identity.url,
    );
  }
  if (dirty.typography) {
    next = { ...next, typography: typographyOfDraft(values.typography) };
  }
  if (dirty.voice) {
    next = { ...next, voice: values.voice };
  }
  if (dirty.music) {
    next = { ...next, music: values.music.map(normalizedTrack) };
  }
  if (dirty.photos) {
    next = { ...next, images: imagesOf(values.photos) };
  }
  if (dirty.devices) {
    next = { ...next, devices: values.devices };
  }
  return next;
}

export function draftInvalidity(values: BrandDraftValues, dirty: DirtySections): TranslationKey | null {
  const { identity } = values;
  if (
    dirty.identity &&
    (identity.name.trim() === '' || identity.spokenName.trim() === '' || identity.tagline.trim() === '')
  ) {
    return 'brands.identity.required';
  }
  if (dirty.music && values.music.some((track) => !trackIsComplete(track))) {
    return 'brands.music.incomplete';
  }
  if (dirty.photos && values.photos.some((row) => row.caption.trim() === '')) {
    return 'brands.photos.captionRequired';
  }
  if (dirty.devices) {
    const devices = Object.values(values.devices);
    if (devices.some((device) => device.name.trim() === '')) {
      return 'brands.devices.nameRequired';
    }
    if (devices.some((device) => device.kind === 'screen' && device.screen === undefined)) {
      return 'brands.devices.screenRequired';
    }
  }
  return null;
}
