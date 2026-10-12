import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { runFfmpegForStderr } from './run-ffmpeg-for-stderr';

export const SCENE_SCORE_SAMPLE_FPS = 4;
export const DEFAULT_MIN_SCENE_SEC = 1.5;
export const MIN_ADAPTIVE_SCENE_THRESHOLD = 0.05;
export const MAX_ADAPTIVE_SCENE_THRESHOLD = 0.3;
export const ADAPTIVE_THRESHOLD_STDDEVS = 2;

const PTS_TIME_PATTERN = /pts_time:\s*(-?\d+(?:\.\d+)?)/;
const SCENE_SCORE_PATTERN = /lavfi\.scene_score=(\d+(?:\.\d+)?)/;

export interface SceneScore {
  readonly atSec: number;
  readonly score: number;
}

export interface DetectSceneCutsOptions {
  threshold?: number;
  minSceneSec?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function parseSceneScores(stderr: string): SceneScore[] {
  const scores: SceneScore[] = [];
  let pendingAtSec: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const time = PTS_TIME_PATTERN.exec(line);
    if (time !== null) {
      pendingAtSec = Number(time[1]);
      continue;
    }
    const score = SCENE_SCORE_PATTERN.exec(line);
    if (score !== null && pendingAtSec !== null) {
      scores.push({ atSec: pendingAtSec, score: Number(score[1]) });
      pendingAtSec = null;
    }
  }
  return scores;
}

export function adaptiveSceneThreshold(scores: readonly SceneScore[]): number {
  if (scores.length === 0) {
    return MAX_ADAPTIVE_SCENE_THRESHOLD;
  }
  const values = scores.map((entry) => entry.score);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const threshold = mean + ADAPTIVE_THRESHOLD_STDDEVS * Math.sqrt(variance);
  return Math.min(MAX_ADAPTIVE_SCENE_THRESHOLD, Math.max(MIN_ADAPTIVE_SCENE_THRESHOLD, threshold));
}

function isLocalPeak(scores: readonly SceneScore[], index: number): boolean {
  const current = scores[index]?.score ?? 0;
  const previous = scores[index - 1]?.score ?? -1;
  const next = scores[index + 1]?.score ?? -1;
  return current >= previous && current >= next;
}

export function pickSceneCuts(scores: readonly SceneScore[], threshold: number, minSceneSec: number): number[] {
  const peaks = scores
    .filter((entry, index) => entry.score >= threshold && isLocalPeak(scores, index))
    .sort((left, right) => right.score - left.score);
  const cuts: number[] = [];
  for (const peak of peaks) {
    const farFromStart = peak.atSec >= minSceneSec;
    const farFromOtherCuts = cuts.every((cutSec) => Math.abs(cutSec - peak.atSec) >= minSceneSec);
    if (farFromStart && farFromOtherCuts) {
      cuts.push(peak.atSec);
    }
  }
  return cuts.sort((left, right) => left - right);
}

export function sceneScoreArgs(path: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-an',
    '-vf',
    `fps=${SCENE_SCORE_SAMPLE_FPS},scale=320:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score`,
    '-f',
    'null',
    '-',
  ];
}

export async function detectSceneCuts(
  videoPath: string,
  runner: CommandRunner,
  opts?: DetectSceneCutsOptions,
): Promise<number[]> {
  const stderr = await runFfmpegForStderr(opts?.ffmpegPath ?? 'ffmpeg', sceneScoreArgs(videoPath), runner, opts?.runOptions);
  const scores = parseSceneScores(stderr);
  const threshold = opts?.threshold ?? adaptiveSceneThreshold(scores);
  return pickSceneCuts(scores, threshold, opts?.minSceneSec ?? DEFAULT_MIN_SCENE_SEC);
}
