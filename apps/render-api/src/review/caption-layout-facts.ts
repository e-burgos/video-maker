import { captionTextRect, introBumperFrames, pipRect, safeZoneFor } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';

import type { CaptionLayoutFacts, OverlayPlacement, PixelRect } from './review-inputs';
import {
  CHAT_BUTTON_ZONE_HEIGHT_RATIO,
  CHAT_BUTTON_ZONE_WIDTH_RATIO,
  PIP_FALLBACK_ASPECT_RATIO,
} from './review-thresholds';

type Frame = { readonly width: number; readonly height: number };

function aspectRatioOf(timeline: Timeline, assetId: string | undefined): number {
  const asset = timeline.assets.find((candidate) => candidate.id === assetId);
  const rotated = asset?.rotation === 90 || asset?.rotation === 270;
  const width = rotated ? asset?.height : asset?.width;
  const height = rotated ? asset?.width : asset?.height;
  return width === undefined || height === undefined ? PIP_FALLBACK_ASPECT_RATIO : width / height;
}

function logoRect(timeline: Timeline, frame: Frame): PixelRect | null {
  const { logo } = timeline;
  if (logo === undefined) {
    return null;
  }
  const margin = Math.round(frame.width * logo.marginRatio);
  const width = Math.min(Math.round(frame.width * logo.widthRatio), Math.max(0, frame.width - 2 * margin));
  const height = Math.round(width / aspectRatioOf(timeline, logo.assetId));
  return {
    x: logo.position.endsWith('-left') ? margin : frame.width - margin - width,
    y: logo.position.startsWith('top-') ? margin : frame.height - margin - height,
    width,
    height,
  };
}

function chatButtonRect(timeline: Timeline, frame: Frame): PixelRect | null {
  if (timeline.delivery?.kind !== 'tutorial') {
    return null;
  }
  const width = Math.round(frame.width * CHAT_BUTTON_ZONE_WIDTH_RATIO);
  const height = Math.round(frame.height * CHAT_BUTTON_ZONE_HEIGHT_RATIO);
  return { x: frame.width - width, y: frame.height - height, width, height };
}

function overlaysOf(timeline: Timeline, frame: Frame, introSec: number): OverlayPlacement[] {
  const fps = timeline.format.fps;
  return timeline.tracks.broll
    .filter((clip) => clip.fit === 'pip')
    .map((clip) => ({
      startSec: introSec + clip.from / fps,
      endSec: introSec + (clip.from + clip.durationFrames) / fps,
      rect: pipRect(frame, aspectRatioOf(timeline, clip.assetId)),
    }));
}

export function buildCaptionLayoutFacts(timeline: Timeline): CaptionLayoutFacts | null {
  if (timeline.captionStyle === 'off' || timeline.tracks.captions.length === 0) {
    return null;
  }
  const frame = { width: timeline.format.width, height: timeline.format.height };
  const safeZone = timeline.safeZone ?? safeZoneFor(timeline.format);
  const fps = timeline.format.fps;
  const introSec = introBumperFrames(timeline) / fps;
  return {
    captions: timeline.tracks.captions.map((clip) => ({
      id: clip.id,
      startSec: introSec + clip.from / fps,
      endSec: introSec + (clip.from + clip.durationFrames) / fps,
      text: clip.words.map((word) => word.text).join(' '),
      rect: captionTextRect(clip.words.map((word) => word.text), clip.emphasisIndex ?? null, timeline.captionStyle ?? null, frame, safeZone),
    })),
    logo: logoRect(timeline, frame),
    chatButton: chatButtonRect(timeline, frame),
    overlays: overlaysOf(timeline, frame, introSec),
  };
}
