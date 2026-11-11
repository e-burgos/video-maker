import { join } from 'node:path';
import type { MediaProject } from '@video-maker/auto-montage';
import { parseBlackDetect } from '@video-maker/media-local';

import type { CliDependencies } from '../deps/cli-dependencies';
import { StageFailedError } from '../errors/stage-failed-error';
import { StageInputMissingError } from '../errors/stage-input-missing-error';
import type { FlashScanReport, FlashScanSegment } from '../report/cli-report';

export const MAX_FLASH_SECONDS = 0.5;
export const WHITE_PIXEL_THRESHOLD = 0.1;
export const WHITE_PICTURE_RATIO = 0.9;

export function whiteFrameArgs(videoPath: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    videoPath,
    '-an',
    '-vf',
    `negate,blackdetect=d=0:pix_th=${WHITE_PIXEL_THRESHOLD}:picture_black_ratio_th=${WHITE_PICTURE_RATIO}`,
    '-f',
    'null',
    '-',
  ];
}

export function classifyWhiteSegments(segments: readonly FlashScanSegment[]): Pick<FlashScanReport, 'flashes' | 'brightStretches'> {
  return {
    flashes: segments.filter((segment) => segment.durationSec < MAX_FLASH_SECONDS),
    brightStretches: segments.filter((segment) => segment.durationSec >= MAX_FLASH_SECONDS),
  };
}

async function newestVideo(project: MediaProject, deps: CliDependencies): Promise<string> {
  const entries = await deps.readDirectory.readDirectory(project.outDir).catch(() => []);
  const videos = entries.filter((entry) => entry.isFile && entry.name.endsWith('.mp4')).map((entry) => join(project.outDir, entry.name));
  const stamped = await Promise.all(videos.map(async (path) => ({ path, modifiedAtMs: (await deps.statFile.statFile(path)).modifiedAtMs })));
  const [newest] = stamped.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);
  if (newest === undefined) {
    throw new StageInputMissingError({ stage: 'render', resource: project.outDir, reason: 'no-rendered-video' });
  }
  return newest.path;
}

export async function flashScanCommand(project: MediaProject, deps: CliDependencies): Promise<FlashScanReport> {
  const videoPath = await newestVideo(project, deps);
  const { ffmpeg } = await deps.resolveBinaries();
  const result = await deps.runner.run(ffmpeg, whiteFrameArgs(videoPath));
  if (result.exitCode !== 0) {
    throw new StageFailedError({ stage: 'render', resource: videoPath, reason: 'flash-scan-failed', cause: result.stderr });
  }
  const segments = parseBlackDetect(result.stderr).map(({ startSec, endSec, durationSec }) => ({ startSec, endSec, durationSec }));
  return { kind: 'flash-scan', videoPath, maxFlashSec: MAX_FLASH_SECONDS, ...classifyWhiteSegments(segments) };
}
