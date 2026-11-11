import { rename, rm } from 'node:fs/promises';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import type { CommandRunner } from '../runner/command-runner';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import { masterLoudnessTarget, masterNormalizationFilters, needsMasterNormalization } from './normalize-master-loudness';
import type { NormalizeMasterLoudnessOptions, NormalizeMasterLoudnessResult } from './normalize-master-loudness';
import type { LoudnessMeasurement } from './parse-loudnorm-json';
import { masterRetryFor } from './true-peak-guard';

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
    masterNormalizationFilters(target, measured).join(','),
    '-c:a',
    'aac',
    '-b:a',
    VIDEO_MASTER_AUDIO_BITRATE,
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

async function encodeNormalizedVideo(
  videoPath: string,
  temporaryPath: string,
  target: VoiceTarget,
  measured: LoudnessMeasurement,
  runner: CommandRunner,
  ffmpegPath: string,
  opts: NormalizeMasterLoudnessOptions | undefined,
): Promise<readonly string[]> {
  const args = videoMasterNormalizationArgs(videoPath, temporaryPath, target, measured);
  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    await rm(temporaryPath, { force: true });
    throw new CommandFailedError({ command: ffmpegPath, args, exitCode: result.exitCode, stderr: result.stderr });
  }
  return args;
}

async function measureEncodedLevels(
  path: string,
  target: VoiceTarget,
  runner: CommandRunner,
  ffmpegPath: string,
  opts: NormalizeMasterLoudnessOptions | undefined,
): Promise<LoudnessMeasurement> {
  try {
    const measured = await measureLoudness(path, runner, {
      target,
      ffmpegPath,
      audioStreamSpecifier: FIRST_AUDIO_STREAM,
      ...(opts?.runOptions !== undefined ? { runOptions: opts.runOptions } : {}),
    });
    return measured;
  } catch (cause) {
    await rm(path, { force: true });
    throw cause;
  }
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
    return { applied: false, measuredBefore, args: null, truePeakRetried: false };
  }

  const temporaryPath = `${videoPath}${VIDEO_NORMALIZATION_TEMP_SUFFIX}`;
  let args = await encodeNormalizedVideo(videoPath, temporaryPath, target, measuredBefore, runner, ffmpegPath, opts);
  const encoded = await measureEncodedLevels(temporaryPath, target, runner, ffmpegPath, opts);
  const retry = masterRetryFor(target, deliveryTarget, target.truePeakDbtp, encoded);
  if (retry.kind !== 'none') {
    args = await encodeNormalizedVideo(videoPath, temporaryPath, retry.target, measuredBefore, runner, ffmpegPath, opts);
  }

  await rename(temporaryPath, videoPath);

  return { applied: true, measuredBefore, args, truePeakRetried: retry.kind === 'true-peak' };
}
