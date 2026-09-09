import type { MediaAsset, Timeline } from '@video-maker/timeline-core';
import { artifactUrl } from './artifact-url';

function playerAsset(asset: MediaAsset, slug: string, origin: string): MediaAsset {
  return { ...asset, path: new URL(artifactUrl(slug, asset.path), origin).toString() };
}

export function playerTimeline(timeline: Timeline, slug: string, origin: string): Timeline {
  return {
    ...timeline,
    assets: timeline.assets.map((asset) => playerAsset(asset, slug, origin)),
  };
}
