import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import { RENDER_FPS } from '../jobs/run-motion-pipeline';
import {
  buildMotionLevelPlans,
  MOTION_MUSIC_FILE,
  motionVoiceFile,
  MotionReviewTimelineSchema,
} from './motion-level-plans';
import type { MotionReviewTimeline } from './motion-level-plans';
import { ReviewInputsUnavailableError } from './review-errors';
import type { ReviewFacts, ReviewScene, ReviewStoragePort } from './review-facts';
import { fileExists } from './review-facts';
import { readMotionSceneVoices } from './motion-scene-voices';
import { parseMotionSfxCues } from './motion-sfx-cues';
import type { MotionSfxCue } from './motion-sfx-cues';

export const MOTION_TIMELINE_PATH = workPath('motion', 'timeline.json');

async function motionScenes(
  project: MediaProject,
  storage: ReviewStoragePort,
  timeline: MotionReviewTimeline,
): Promise<ReviewScene[]> {
  const voices = await readMotionSceneVoices(project, storage);
  return timeline.scenes.map((scene) => ({
    id: scene.id,
    startSec: scene.start,
    endSec: scene.end,
    voice: voices.get(scene.id) ?? null,
  }));
}

const MOTION_COMPOSITION_FILE = 'index.html';

async function existingSfxCues(workDirectory: string, storage: ReviewStoragePort): Promise<MotionSfxCue[]> {
  const compositionPath = `${workDirectory}/${MOTION_COMPOSITION_FILE}`;
  if (!(await fileExists(storage, compositionPath))) {
    return [];
  }
  const cues = parseMotionSfxCues(await storage.readTextFile(compositionPath));
  const present: MotionSfxCue[] = [];
  for (const cue of cues) {
    if (await fileExists(storage, `${workDirectory}/${cue.src}`)) {
      present.push(cue);
    }
  }
  return present;
}

export async function collectMotionFacts(project: MediaProject, storage: ReviewStoragePort): Promise<ReviewFacts> {
  const timelinePath = toAbsolutePath(project, MOTION_TIMELINE_PATH);
  if (!(await fileExists(storage, timelinePath))) {
    throw new ReviewInputsUnavailableError(MOTION_TIMELINE_PATH, 'no existe la timeline del video motion');
  }
  const timeline = MotionReviewTimelineSchema.parse(JSON.parse(await storage.readTextFile(timelinePath)));
  const workDirectory = toAbsolutePath(project, workPath('motion'));

  const missingAssets: string[] = [];
  for (const scene of timeline.scenes) {
    if (!(await fileExists(storage, `${workDirectory}/${motionVoiceFile(scene.id)}`))) {
      missingAssets.push(`${workPath('motion')}/${motionVoiceFile(scene.id)}`);
    }
  }
  const hasMusic = await fileExists(storage, `${workDirectory}/${MOTION_MUSIC_FILE}`);

  return {
    explicitDelivery: undefined,
    dimensions: null,
    fps: RENDER_FPS,
    expectedDurationSec: timeline.duration,
    bumpers: [],
    bumperOffsetSec: 0,
    levelPlans: buildMotionLevelPlans(timeline, workDirectory, hasMusic, await existingSfxCues(workDirectory, storage)),
    hasVoice: timeline.scenes.length > 0 && missingAssets.length < timeline.scenes.length,
    captionStyle: null,
    captions: [],
    frame: null,
    missingAssets,
    scenes: await motionScenes(project, storage, timeline),
    promise: null,
  };
}
