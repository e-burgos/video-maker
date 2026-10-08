import type { MotionBrand, MotionBrief, MotionFormat } from './motion-types';

export const MUSIC_AUTO = 'auto';
export const MUSIC_NONE = 'none';

export type BriefImageDraft = {
  included: boolean;
  caption: string;
};

export type BriefDraft = {
  brand: string;
  format: MotionFormat;
  music: string;
  beatSync: boolean;
  title: string;
  goal: string;
  audience: string;
  script: string;
  images: Record<string, BriefImageDraft>;
};

export function emptyBriefDraft(brands: readonly MotionBrand[], preferredBrand: string | null = null): BriefDraft {
  const brand = brands.find((candidate) => candidate.id === preferredBrand) ?? brands[0];
  return {
    brand: brand?.id ?? '',
    format: '16:9',
    music: brand !== undefined && brand.music.length === 0 ? MUSIC_NONE : MUSIC_AUTO,
    beatSync: true,
    title: '',
    goal: '',
    audience: '',
    script: '',
    images: {},
  };
}

export function draftFromBrief(brief: MotionBrief): BriefDraft {
  return {
    brand: brief.brand,
    format: brief.format,
    music: brief.music === null ? MUSIC_NONE : brief.music,
    beatSync: brief.beatSync,
    title: brief.title ?? '',
    goal: brief.goal ?? '',
    audience: brief.audience ?? '',
    script: brief.script,
    images: Object.fromEntries(
      brief.images.map((image) => [image.file, { included: true, caption: image.caption }]),
    ),
  };
}

export function draftToBrief(draft: BriefDraft, availableImages: readonly string[]): MotionBrief {
  const title = draft.title.trim();
  const goal = draft.goal.trim();
  const audience = draft.audience.trim();

  return {
    version: 1,
    brand: draft.brand,
    ...(title === '' ? {} : { title }),
    format: draft.format,
    beatSync: draft.beatSync,
    music: draft.music === MUSIC_NONE ? null : draft.music,
    ...(goal === '' ? {} : { goal }),
    ...(audience === '' ? {} : { audience }),
    script: draft.script,
    images: availableImages
      .filter((file) => draft.images[file]?.included === true)
      .map((file) => ({ file, caption: draft.images[file]?.caption ?? '' })),
  };
}

export function imageFileName(assetPath: string): string {
  return assetPath.split('/').pop() ?? assetPath;
}

export function musicAfterBrandChange(current: string, brand: MotionBrand | undefined): string {
  if (brand === undefined || current === MUSIC_NONE) {
    return current;
  }
  if (brand.music.length === 0) {
    return MUSIC_NONE;
  }
  const keepable = current === MUSIC_AUTO || brand.music.some((track) => track.id === current);
  return keepable ? current : MUSIC_AUTO;
}
