import { MediaAssetSchema } from '@video-maker/timeline-core';
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

const DEFAULT_LOGO_OVERLAY = {
  widthRatio: 0.32,
  marginRatio: 0.035,
  opacity: 1,
} as const;

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
      ...DEFAULT_LOGO_OVERLAY,
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
