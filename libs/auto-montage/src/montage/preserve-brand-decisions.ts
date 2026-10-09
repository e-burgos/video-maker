import type { MediaAsset, Timeline, TimelineBumpers } from '@video-maker/timeline-core';

const BUMPER_EDGES = ['intro', 'outro'] as const;

function bumperLogoAssetIds(bumpers: TimelineBumpers | undefined): string[] {
  return BUMPER_EDGES.flatMap((edge) => {
    const assetId = bumpers?.[edge]?.logoAssetId;
    return assetId === undefined ? [] : [assetId];
  });
}

function withBumperLogoAssets(
  assets: readonly MediaAsset[],
  bumpers: TimelineBumpers | undefined,
  previousAssets: readonly MediaAsset[],
): MediaAsset[] {
  const missing = bumperLogoAssetIds(bumpers)
    .filter((assetId) => !assets.some((asset) => asset.id === assetId))
    .flatMap((assetId) => previousAssets.filter((asset) => asset.id === assetId));
  const unique = missing.filter(
    (asset, index) => missing.findIndex((candidate) => candidate.id === asset.id) === index,
  );
  return [...assets, ...unique];
}

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
    assets: withBumperLogoAssets(timeline.assets, bumpers, previous.assets),
    ...(logo === undefined ? {} : { logo }),
    ...(bumpers === undefined ? {} : { bumpers }),
  };
}
