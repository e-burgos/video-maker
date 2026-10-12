import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { runFfmpegForStderr } from './run-ffmpeg-for-stderr';

export const DEFAULT_SCENE_CUT_THRESHOLD = 0.3;
export const DEFAULT_MIN_SCENE_SEC = 0.4;

const SHOWINFO_PTS_TIME_PATTERN = /Parsed_showinfo[^\n]*?pts_time:\s*(-?\d+(?:\.\d+)?)/;

export interface DetectSceneCutsOptions {
  threshold?: number;
  minSceneSec?: number;
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export function parseShowinfoCutTimes(stderr: string): number[] {
  const times: number[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const match = SHOWINFO_PTS_TIME_PATTERN.exec(line);
    if (match !== null) {
      times.push(Number(match[1]));
    }
  }
  return times;
}

export function mergeCloseCuts(cutTimesSec: readonly number[], minSceneSec: number): number[] {
  const merged: number[] = [];
  let previousBoundarySec = 0;
  for (const cutSec of [...cutTimesSec].sort((left, right) => left - right)) {
    if (cutSec - previousBoundarySec >= minSceneSec) {
      merged.push(cutSec);
      previousBoundarySec = cutSec;
    }
  }
  return merged;
}

export function sceneCutArgs(path: string, threshold: number): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-an',
    '-vf',
    `select='gt(scene,${threshold})',showinfo`,
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
  const threshold = opts?.threshold ?? DEFAULT_SCENE_CUT_THRESHOLD;
  const minSceneSec = opts?.minSceneSec ?? DEFAULT_MIN_SCENE_SEC;
  const stderr = await runFfmpegForStderr(opts?.ffmpegPath ?? 'ffmpeg', sceneCutArgs(videoPath, threshold), runner, opts?.runOptions);
  return mergeCloseCuts(parseShowinfoCutTimes(stderr), minSceneSec);
}
