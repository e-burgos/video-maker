import {
  LANDSCAPE_LOGO_WIDTH_RATIO,
  MediaAssetSchema,
  PORTRAIT_LOGO_WIDTH_RATIO,
  defaultLogoWidthRatio,
} from '@video-maker/timeline-core';
import type { LogoPosition, MediaAsset, Timeline } from '@video-maker/timeline-core';

import type { AssetListing } from '../render-api-types';
import type { Blocker } from '../blockers';

export const LOGO_POSITIONS: readonly LogoPosition[] = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
];

export const DEFAULT_LOGO_POSITION: LogoPosition = 'bottom-right';

const DEFAULT_LOGO_MARGIN_RATIO = 0.035;
const DEFAULT_LOGO_OPACITY = 1;

export const LOGO_SIZES = ['small', 'medium', 'large'] as const;

export type LogoSize = (typeof LOGO_SIZES)[number];

export const LOGO_WIDTH_RATIO_BY_SIZE: Readonly<Record<LogoSize, number>> = {
  small: 0.12,
  medium: LANDSCAPE_LOGO_WIDTH_RATIO,
  large: PORTRAIT_LOGO_WIDTH_RATIO,
};

export function logoSizeOf(widthRatio: number): LogoSize {
  return (
    LOGO_SIZES.find((size) => LOGO_WIDTH_RATIO_BY_SIZE[size] === widthRatio) ??
    LOGO_SIZES.reduce((closest, size) =>
      Math.abs(LOGO_WIDTH_RATIO_BY_SIZE[size] - widthRatio) <
      Math.abs(LOGO_WIDTH_RATIO_BY_SIZE[closest] - widthRatio)
        ? size
        : closest,
    )
  );
}

export function logoAssetsWithoutAlpha(listing: AssetListing | null): string[] {
  return (listing?.assets ?? [])
    .filter((entry) => entry.role === 'logo' && entry.media?.hasAlpha === false)
    .map((entry) => entry.path);
}

export function logoAssetsOf(listing: AssetListing | null): MediaAsset[] {
  if (listing === null) {
    return [];
  }

  return listing.assets
    .filter((entry) => entry.role === 'logo' && entry.media !== null)
    .map((entry) => MediaAssetSchema.safeParse(entry.media))
    .filter((parsed) => parsed.success && parsed.data.kind === 'image')
    .map((parsed) => (parsed as { data: MediaAsset }).data);
}

export function logoBlockers(listing: AssetListing | null): Blocker[] {
  if (listing === null) {
    return [{ key: 'logo.blocker.listingNotLoaded' }];
  }

  if (logoAssetsOf(listing).length > 0) {
    return [];
  }

  return listing.source === 'raw-scan'
    ? [{ key: 'logo.blocker.noCatalog' }]
    : [{ key: 'logo.blocker.noLogoAsset' }];
}

export function setTimelineLogo(
  timeline: Timeline,
  asset: MediaAsset,
  position: LogoPosition,
): Timeline {
  const assets = timeline.assets.some((candidate) => candidate.id === asset.id)
    ? timeline.assets
    : [...timeline.assets, asset];

  return {
    ...timeline,
    assets,
    logo: {
      widthRatio: defaultLogoWidthRatio(timeline.format),
      marginRatio: DEFAULT_LOGO_MARGIN_RATIO,
      opacity: DEFAULT_LOGO_OPACITY,
      ...(timeline.logo?.assetId === asset.id ? timeline.logo : {}),
      assetId: asset.id,
      position,
    },
  };
}

function isReferencedByAClip(timeline: Timeline, assetId: string): boolean {
  const { aroll, broll, voice, music } = timeline.tracks;
  return [...aroll, ...broll, ...voice, ...music].some((clip) => clip.assetId === assetId);
}

export function clearTimelineLogo(timeline: Timeline): Timeline {
  const { logo, ...rest } = timeline;

  if (logo === undefined) {
    return timeline;
  }

  return {
    ...rest,
    assets: isReferencedByAClip(timeline, logo.assetId)
      ? timeline.assets
      : timeline.assets.filter((asset) => asset.id !== logo.assetId),
  };
}

export function setTimelineLogoStyle(
  timeline: Timeline,
  style: { widthRatio: number; opacity: number },
): Timeline {
  if (timeline.logo === undefined) {
    return timeline;
  }

  return { ...timeline, logo: { ...timeline.logo, ...style } };
}
