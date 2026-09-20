import type { Timeline } from '@video-maker/timeline-core';

export function preserveBrandDecisions(timeline: Timeline, previous: Timeline | null): Timeline {
  if (previous === null) {
    return timeline;
  }

  const previousLogo = previous.logo;
  const keepsLogoAsset =
    previousLogo !== undefined && timeline.assets.some((asset) => asset.id === previousLogo.assetId);
  const logo = keepsLogoAsset ? previousLogo : timeline.logo;
  const bumpers = previous.bumpers ?? timeline.bumpers;

  return {
    ...timeline,
    ...(logo === undefined ? {} : { logo }),
    ...(bumpers === undefined ? {} : { bumpers }),
  };
}
