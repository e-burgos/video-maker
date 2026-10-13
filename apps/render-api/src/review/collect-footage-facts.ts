import { isAbsolute } from 'node:path';

import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { introBumperFrames, outroBumperFrames, safeZoneFor, TimelineSchema, timelineTotalFrames } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';

import { buildCaptionLayoutFacts } from './caption-layout-facts';
import { buildFootageLevelPlans } from './footage-level-plans';
import { ReviewInputsUnavailableError } from './review-errors';
import type { ReviewFacts, ReviewStoragePort } from './review-facts';
import { fileExists } from './review-facts';
import type { ReviewCaption, SecondsRange } from './review-inputs';

export const FOOTAGE_TIMELINE_PATH = 'work/timeline.json';

function absoluteAssetPath(project: MediaProject, path: string): string {
  return isAbsolute(path) ? path : toAbsolutePath(project, path);
}

function referencedAssetIds(timeline: Timeline): string[] {
  const { aroll, broll, voice, music } = timeline.tracks;
  const ids = [
    ...[...aroll, ...broll, ...voice, ...music].map((clip) => clip.assetId),
    ...(timeline.logo === undefined ? [] : [timeline.logo.assetId]),
    ...[timeline.bumpers?.intro, timeline.bumpers?.outro].flatMap((bumper) =>
      bumper?.enabled === true && bumper.logoAssetId !== undefined ? [bumper.logoAssetId] : [],
    ),
  ];
  return [...new Set(ids)];
}

async function findMissingAssets(
  timeline: Timeline,
  project: MediaProject,
  storage: ReviewStoragePort,
): Promise<string[]> {
  const missing: string[] = [];
  for (const assetId of referencedAssetIds(timeline)) {
    const asset = timeline.assets.find((candidate) => candidate.id === assetId);
    const path = asset === undefined ? assetId : asset.path;
    if (asset === undefined || !(await fileExists(storage, absoluteAssetPath(project, path)))) {
      missing.push(path);
    }
  }
  return missing;
}

function bumperRanges(timeline: Timeline): SecondsRange[] {
  const fps = timeline.format.fps;
  const intro = introBumperFrames(timeline);
  const outro = outroBumperFrames(timeline);
  const total = timelineTotalFrames(timeline);
  return [
    ...(intro > 0 ? [{ startSec: 0, endSec: intro / fps }] : []),
    ...(outro > 0 ? [{ startSec: (total - outro) / fps, endSec: total / fps }] : []),
  ];
}

function captionsOf(timeline: Timeline): ReviewCaption[] {
  const fps = timeline.format.fps;
  const introSec = introBumperFrames(timeline) / fps;
  return timeline.tracks.captions.map((clip) => ({
    id: clip.id,
    startSec: introSec + clip.from / fps,
    endSec: introSec + (clip.from + clip.durationFrames) / fps,
    text: clip.words.map((word) => word.text).join(' '),
    box: clip.box ?? null,
  }));
}

async function readTimeline(project: MediaProject, storage: ReviewStoragePort): Promise<Timeline> {
  const path = toAbsolutePath(project, FOOTAGE_TIMELINE_PATH);
  if (!(await fileExists(storage, path))) {
    throw new ReviewInputsUnavailableError(FOOTAGE_TIMELINE_PATH, 'no existe la Timeline del proyecto');
  }
  return TimelineSchema.parse(JSON.parse(await storage.readTextFile(path)));
}

export async function collectFootageFacts(project: MediaProject, storage: ReviewStoragePort): Promise<ReviewFacts> {
  const timeline = await readTimeline(project, storage);
  const fps = timeline.format.fps;
  const resolveAssetPath = (assetId: string): string | null => {
    const asset = timeline.assets.find((candidate) => candidate.id === assetId);
    return asset === undefined ? null : absoluteAssetPath(project, asset.path);
  };

  return {
    explicitDelivery: timeline.delivery,
    dimensions: { width: timeline.format.width, height: timeline.format.height },
    fps,
    expectedDurationSec: timelineTotalFrames(timeline) / fps,
    bumpers: bumperRanges(timeline),
    bumperOffsetSec: introBumperFrames(timeline) / fps,
    levelPlans: await buildFootageLevelPlans(timeline, resolveAssetPath),
    hasVoice: timeline.tracks.voice.length > 0,
    captionStyle: timeline.captionStyle ?? null,
    captions: timeline.captionStyle === 'off' ? [] : captionsOf(timeline),
    frame: {
      width: timeline.format.width,
      height: timeline.format.height,
      safeZone: timeline.safeZone ?? safeZoneFor(timeline.format),
    },
    captionLayout: buildCaptionLayoutFacts(timeline),
    missingAssets: await findMissingAssets(timeline, project, storage),
    scenes: [],
    promise: null,
  };
}
