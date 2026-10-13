import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { VISUAL_NOT_REVIEWED_CHECK } from '@video-maker/timeline-core';
import type { SceneFrame, SceneFrameShot } from '@video-maker/timeline-core';

import type { FindingDraft } from './review-finding-builder';
import type { ReviewScene, ReviewStoragePort } from './review-facts';
import type { ReviewMeasurements } from './review-measurements';
import { sceneFrameTimes } from './scene-frame-plan';

export const SCENE_FRAME_MAX_LONG_SIDE_PX = 960;
const REVIEW_DIRECTORY_SUFFIX = '.review';

export function sceneFramesDirectory(videoFile: string): string {
  return `${videoFile.slice(0, -'.mp4'.length)}${REVIEW_DIRECTORY_SUFFIX}`;
}

export function sceneFrameFile(videoFile: string, index: number, shot: number | null = null): string {
  const suffix = shot === null ? '' : `-f${String(shot)}`;
  return `${sceneFramesDirectory(videoFile)}/scene-${String(index).padStart(2, '0')}${suffix}.jpg`;
}

export interface SceneFrameRequest {
  readonly project: MediaProject;
  readonly file: string;
  readonly scenes: readonly ReviewScene[];
  readonly durationSec: number;
}

export async function extractSceneFrames(
  request: SceneFrameRequest,
  storage: ReviewStoragePort,
  measurements: ReviewMeasurements,
): Promise<SceneFrame[]> {
  if (request.scenes.length === 0) {
    return [];
  }
  await storage.ensureDirectory(toAbsolutePath(request.project, sceneFramesDirectory(request.file)));
  const frames: SceneFrame[] = [];
  for (const [position, scene] of request.scenes.entries()) {
    const index = position + 1;
    const times = sceneFrameTimes(scene.startSec, scene.endSec, scene.voice);
    const shots: SceneFrameShot[] = [];
    for (const [shotPosition, rawSec] of times.entries()) {
      const atSec = Math.min(Math.max(0, rawSec), Math.max(0, request.durationSec - 0.05));
      const frame = sceneFrameFile(request.file, index, times.length === 1 ? null : shotPosition + 1);
      await measurements.extractFrame(
        toAbsolutePath(request.project, request.file),
        atSec,
        toAbsolutePath(request.project, frame),
        SCENE_FRAME_MAX_LONG_SIDE_PX,
      );
      shots.push({ atSec, frame });
    }
    frames.push({
      sceneId: scene.id,
      index,
      startSec: scene.startSec,
      endSec: scene.endSec,
      frames: shots,
      ...(scene.voice === null ? {} : { voice: scene.voice }),
    });
  }
  return frames;
}

export function visualNotReviewedFindings(sceneFrames: readonly SceneFrame[]): FindingDraft[] {
  if (sceneFrames.length === 0) {
    return [];
  }
  const totalFrames = sceneFrames.reduce((total, scene) => total + scene.frames.length, 0);
  return [{
    check: VISUAL_NOT_REVIEWED_CHECK,
    severity: 'critical',
    message: `Nadie miró todavía las ${String(sceneFrames.length)} escenas de este render (${String(totalFrames)} cuadros): ningún control visual quedó registrado.`,
    proposedFix: 'Mirar con view_images todos los cuadros de cada escena de sceneFrames y registrar la revisión visual con record_visual_review.',
  }];
}
