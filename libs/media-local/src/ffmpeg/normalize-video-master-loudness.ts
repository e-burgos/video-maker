import { rename, rm } from 'node:fs/promises';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandRunner } from '../runner/command-runner';
import { AUDIO_MIX_SAMPLE_RATE } from '../mix/audio-mix-format';
import { buildLoudnormFilter } from './build-loudnorm-filter';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import { masterLoudnessTarget, needsMasterNormalization } from './normalize-master-loudness';
import type { NormalizeMasterLoudnessOptions, NormalizeMasterLoudnessResult } from './normalize-master-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

export const VIDEO_NORMALIZATION_TEMP_SUFFIX = '.normalized.mp4';
export const VIDEO_MASTER_AUDIO_BITRATE = '192k';

export function videoMasterNormalizationArgs(
  inputPath: string,
  outputPath: string,
  target: VoiceTarget,
  measured: LoudnessMeasurement,
): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    FIRST_AUDIO_STREAM,
    '-c:v',
    'copy',
    '-af',
    `${buildLoudnormFilter(target, measured)},aresample=${String(AUDIO_MIX_SAMPLE_RATE)}`,
    '-c:a',
    'aac',
    '-b:a',
    VIDEO_MASTER_AUDIO_BITRATE,
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

export async function normalizeVideoMasterLoudness(
  videoPath: string,
  deliveryTarget: VoiceTarget,
  runner: CommandRunner,
  opts?: NormalizeMasterLoudnessOptions,
): Promise<NormalizeMasterLoudnessResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';
  const target = masterLoudnessTarget(deliveryTarget);
  const measuredBefore = await measureLoudness(videoPath, runner, {
    target,
    ffmpegPath,
    audioStreamSpecifier: FIRST_AUDIO_STREAM,
    ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
  });

  if (!needsMasterNormalization(measuredBefore, target)) {
    return { applied: false, measuredBefore, args: null };
  }

  const temporaryPath = `${videoPath}${VIDEO_NORMALIZATION_TEMP_SUFFIX}`;
  const args = videoMasterNormalizationArgs(videoPath, temporaryPath, target, measuredBefore);
  const result = await runner.run(ffmpegPath, args, opts?.runOptions);

  if (result.exitCode !== 0) {
    await rm(temporaryPath, { force: true });
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }

  await rename(temporaryPath, videoPath);

  return { applied: true, measuredBefore, args };
}
