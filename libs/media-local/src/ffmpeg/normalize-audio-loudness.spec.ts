import { writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { AUDIO_NORMALIZATION_TEMP_SUFFIX, audioGainArgs, normalizeAudioLoudness } from './normalize-audio-loudness';

function loudnormJson(inputI: number): string {
  return JSON.stringify({
    input_i: String(inputI),
    input_tp: '-0.50',
    input_lra: '6.00',
    input_thresh: '-22.00',
    output_i: '-24.00',
    output_tp: '-2.00',
    output_lra: '6.00',
    output_thresh: '-34.00',
    normalization_type: 'dynamic',
    target_offset: '0.00',
  });
}

describe('audioGainArgs (FIX-e-burgos-015)', () => {
  it('applies a single linear gain and keeps the mix sample rate', () => {
    expect(audioGainArgs('/a/music.wav', '/a/music.wav.leveled.wav', -11.7)).toEqual([
      '-hide_banner', '-nostats', '-y', '-i', '/a/music.wav', '-af', 'volume=-11.70dB', '-ar', '48000', '/a/music.wav.leveled.wav',
    ]);
  });
});

describe('normalizeAudioLoudness (FIX-e-burgos-015)', () => {
  let directory: string;
  let audioPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'audio-level-'));
    audioPath = join(directory, 'music.wav');
    await writeFile(audioPath, 'original');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('lowers a loud music bed to the target with the measured gain', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-f', 'null'], response: { stderr: loudnormJson(-12.3), exitCode: 0 } },
      {
        bin: 'ffmpeg',
        argsPattern: ['-af'],
        response: () => {
          writeFileSync(`${audioPath}${AUDIO_NORMALIZATION_TEMP_SUFFIX}`, 'leveled');
          return { stderr: '', exitCode: 0 };
        },
      },
    ]);

    const result = await normalizeAudioLoudness(audioPath, -24, runner);

    expect(result.applied).toBe(true);
    expect(result.gainDb).toBeCloseTo(-11.7, 5);
    expect(runner.calls[1]?.args).toContain('volume=-11.70dB');
    expect(await readFile(audioPath, 'utf8')).toBe('leveled');
  });

  it('leaves the file untouched when it is already within half a LU of the target', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: loudnormJson(-24.3), exitCode: 0 } }]);

    const result = await normalizeAudioLoudness(audioPath, -24, runner);

    expect(result.applied).toBe(false);
    expect(runner.calls).toHaveLength(1);
    expect(await readFile(audioPath, 'utf8')).toBe('original');
  });
});
