import { extractFrame } from './extract-frame';
import type { ExtractFrameOptions } from './extract-frame';
import type { CommandRunner } from '../runner/command-runner';
import type { DetectedSegment } from './time-segment';
import { toDetectedSegment } from './time-segment';

export interface VideoScene extends DetectedSegment {
  readonly index: number;
}

export interface SceneKeyframe {
  readonly index: number;
  readonly atSec: number;
  readonly path: string;
}

export function buildScenesFromCuts(
  cutTimesSec: readonly number[],
  videoDurationSec: number,
  minSceneSec: number,
): VideoScene[] {
  const innerCuts = cutTimesSec.filter(
    (cutSec) => cutSec > 0 && videoDurationSec - cutSec >= minSceneSec,
  );
  const boundaries = [0, ...innerCuts, videoDurationSec];
  return boundaries.slice(0, -1).map((startSec, index) => ({
    index,
    ...toDetectedSegment(startSec, boundaries[index + 1] ?? videoDurationSec),
  }));
}

export function sceneMidpointSec(scene: Pick<VideoScene, 'startSec' | 'endSec'>): number {
  return Math.round(((scene.startSec + scene.endSec) / 2) * 1000) / 1000;
}

export async function extractSceneKeyframes(
  videoPath: string,
  scenes: readonly VideoScene[],
  keyframePathFor: (scene: VideoScene) => string,
  runner: CommandRunner,
  opts?: ExtractFrameOptions,
  onKeyframe?: (done: number, total: number) => void,
): Promise<SceneKeyframe[]> {
  const keyframes: SceneKeyframe[] = [];
  for (const scene of scenes) {
    const atSec = sceneMidpointSec(scene);
    const path = await extractFrame(videoPath, atSec, keyframePathFor(scene), runner, opts);
    keyframes.push({ index: scene.index, atSec, path });
    onKeyframe?.(keyframes.length, scenes.length);
  }
  return keyframes;
}
