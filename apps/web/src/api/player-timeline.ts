import type { CaptionTheme, MediaAsset, Timeline } from '@video-maker/timeline-core';
import { artifactUrl } from './artifact-url';

function playerAsset(asset: MediaAsset, slug: string, origin: string): MediaAsset {
  return { ...asset, path: new URL(artifactUrl(slug, asset.path), origin).toString() };
}

function playerCaptionTheme(theme: CaptionTheme, slug: string, origin: string): CaptionTheme {
  return {
    ...theme,
    fontFiles: theme.fontFiles.map((file) => ({ ...file, path: new URL(artifactUrl(slug, file.path), origin).toString() })),
  };
}

export function playerTimeline(timeline: Timeline, slug: string, origin: string): Timeline {
  return {
    ...timeline,
    assets: timeline.assets.map((asset) => playerAsset(asset, slug, origin)),
    ...(timeline.captionTheme === undefined ? {} : { captionTheme: playerCaptionTheme(timeline.captionTheme, slug, origin) }),
  };
}
