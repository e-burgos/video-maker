import { existsSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import { masterLoudnessTarget } from './normalize-master-loudness';
import {
  VIDEO_NORMALIZATION_TEMP_SUFFIX,
  normalizeVideoMasterLoudness,
  videoMasterNormalizationArgs,
} from './normalize-video-master-loudness';

function loudnormJson(inputI: number, inputTp: number): string {
  return JSON.stringify({
    input_i: String(inputI),
    input_tp: String(inputTp),
    input_lra: '9.00',
    input_thresh: '-30.00',
    output_i: '-14.00',
    output_tp: '-1.50',
    output_lra: '7.00',
    output_thresh: '-24.00',
    normalization_type: 'dynamic',
    target_offset: '0.10',
  });
}

describe('videoMasterNormalizationArgs (FIX-e-burgos-014)', () => {
  const args = videoMasterNormalizationArgs('/out/video.mp4', '/out/video.mp4.normalized.mp4', masterLoudnessTarget(DEFAULT_VOICE_TARGET), {
    integratedLufs: -20.1,
    truePeakDbtp: -4.2,
    loudnessRange: 9,
    thresholdLufs: -30,
    targetOffsetDb: 0.1,
  });

  it('copies the video stream and re-encodes only the first audio stream with a linear loudnorm', () => {
    expect(args.slice(args.indexOf('-map'), args.indexOf('-map') + 6)).toEqual(['-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy']);
    expect(args[args.indexOf('-af') + 1]).toMatch(/^loudnorm=I=-14:TP=-1\.5:.*measured_I=-20\.10:.*linear=true.*,aresample=48000$/u);
    expect(args.at(-1)).toBe('/out/video.mp4.normalized.mp4');
  });
});

describe('normalizeVideoMasterLoudness (FIX-e-burgos-014)', () => {
  let directory: string;
  let videoPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'video-normalize-'));
    videoPath = join(directory, 'video.mp4');
    await writeFile(videoPath, 'original');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('leaves the video untouched when its audio is already on target', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: loudnormJson(-14.1, -1.8), exitCode: 0 } }]);

    const result = await normalizeVideoMasterLoudness(videoPath, DEFAULT_VOICE_TARGET, runner);

    expect(result.applied).toBe(false);
    expect(runner.calls).toHaveLength(1);
    expect(await readFile(videoPath, 'utf8')).toBe('original');
  });

  it('rewrites the video with the normalized audio when it is 6 LU low', async () => {
    const temporaryPath = `${videoPath}${VIDEO_NORMALIZATION_TEMP_SUFFIX}`;
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: loudnormJson(-20.1, -4.2), exitCode: 0 } },
      {
        bin: 'ffmpeg',
        argsPattern: ['-c:v', 'copy'],
        response: () => {
          writeFileSync(temporaryPath, 'normalized');
          return { stderr: '', exitCode: 0 };
        },
      },
    ]);

    const result = await normalizeVideoMasterLoudness(videoPath, DEFAULT_VOICE_TARGET, runner);

    expect(result.applied).toBe(true);
    expect(result.measuredBefore.integratedLufs).toBe(-20.1);
    expect(await readFile(videoPath, 'utf8')).toBe('normalized');
    expect(existsSync(temporaryPath)).toBe(false);
  });

  it('keeps the original video and throws when the normalization pass fails', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: loudnormJson(-20.1, -4.2), exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: ['-c:v', 'copy'], response: { stderr: 'boom', exitCode: 1 } },
    ]);

    await expect(normalizeVideoMasterLoudness(videoPath, DEFAULT_VOICE_TARGET, runner)).rejects.toBeInstanceOf(CommandFailedError);
    expect(await readFile(videoPath, 'utf8')).toBe('original');
  });
});
