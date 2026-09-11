import type { Timeline } from '@video-maker/timeline-core';

export const TIMELINE_CLIP_TRACKS = ['aroll', 'broll', 'voice', 'music'] as const;

export type TimelineClipTrack = (typeof TIMELINE_CLIP_TRACKS)[number];

export type TimelineAssetReference =
  | { readonly kind: 'asset' }
  | { readonly kind: 'clip'; readonly track: TimelineClipTrack; readonly clipId: string }
  | { readonly kind: 'logo' };

export function findTimelineAssetReferences(
  timeline: Timeline | null,
  assetId: string,
): readonly TimelineAssetReference[] {
  if (timeline === null) {
    return [];
  }

  const references: TimelineAssetReference[] = [];

  if (timeline.assets.some((asset) => asset.id === assetId)) {
    references.push({ kind: 'asset' });
  }

  for (const track of TIMELINE_CLIP_TRACKS) {
    for (const clip of timeline.tracks[track]) {
      if (clip.assetId === assetId) {
        references.push({ kind: 'clip', track, clipId: clip.id });
      }
    }
  }

  if (timeline.logo?.assetId === assetId) {
    references.push({ kind: 'logo' });
  }

  return references;
}

export function describeTimelineAssetReferences(
  references: readonly TimelineAssetReference[],
): string {
  return references
    .map((reference) => {
      if (reference.kind === 'clip') {
        return `tracks.${reference.track} clip ${reference.clipId}`;
      }
      return reference.kind;
    })
    .join(', ');
}
