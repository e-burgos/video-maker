import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { measureSegmentLoudness, parseEbur128IntegratedLufs, segmentLoudnessArgs } from './measure-segment-loudness';

const SPEECH_STDERR = `[Parsed_ebur128_0 @ 0xaf500e040] t: 4.899979   TARGET:-23 LUFS    M: -17.1 S: -18.2     I: -18.8 LUFS       LRA:   2.2 LU
[Parsed_ebur128_0 @ 0xaf500e040] t: 4.999979   TARGET:-23 LUFS    M: -16.6 S: -18.2     I: -18.7 LUFS       LRA:   2.6 LU
[Parsed_ebur128_0 @ 0xb9100d140] Summary:

  Integrated loudness:
    I:         -18.7 LUFS
    Threshold: -29.4 LUFS

  Loudness range:
    LRA:         2.6 LU
    Threshold: -39.3 LUFS
    LRA low:   -20.8 LUFS
    LRA high:  -18.2 LUFS
`;

const SILENCE_STDERR = `[Parsed_ebur128_0 @ 0xc05414cc0] Summary:

  Integrated loudness:
    I:         -70.0 LUFS
    Threshold:   0.0 LUFS

  Loudness range:
    LRA:         0.0 LU
`;

const INFINITE_STDERR = `[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -inf LUFS
`;

describe('parseEbur128IntegratedLufs', () => {
  it('reads the Summary block and ignores the running I: values', () => {
    expect(parseEbur128IntegratedLufs(SPEECH_STDERR)).toBe(-18.7);
  });

  it('returns null for a fully silent segment', () => {
    expect(parseEbur128IntegratedLufs(SILENCE_STDERR)).toBeNull();
    expect(parseEbur128IntegratedLufs(INFINITE_STDERR)).toBeNull();
  });

  it('fails when there is no Summary block', () => {
    expect(() => parseEbur128IntegratedLufs('nothing here')).toThrow(UnparseableOutputError);
  });
});

describe('segmentLoudnessArgs', () => {
  it('seeks the input and limits the duration to the segment', () => {
    expect(segmentLoudnessArgs('/a/b.mp4', { startSec: 2, endSec: 7 })).toEqual([
      '-hide_banner', '-nostats', '-ss', '2', '-t', '5', '-i', '/a/b.mp4', '-vn', '-af', 'ebur128', '-f', 'null', '-',
    ]);
  });
});

describe('measureSegmentLoudness', () => {
  it('measures each segment with its own ffmpeg call', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: ['-ss', '0'], response: { stderr: SPEECH_STDERR, exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: ['-ss', '10'], response: { stderr: SILENCE_STDERR, exitCode: 0 } },
    ]);

    const loudness = await measureSegmentLoudness(
      '/a/b.mp4',
      [{ startSec: 0, endSec: 5 }, { startSec: 10, endSec: 12 }],
      runner,
    );

    expect(loudness).toEqual([-18.7, null]);
    expect(runner.calls).toHaveLength(2);
  });

  it('throws when ffmpeg fails', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: 'boom', exitCode: 1 } }]);

    await expect(measureSegmentLoudness('/a/b.mp4', [{ startSec: 0, endSec: 1 }], runner)).rejects.toThrow(
      CommandFailedError,
    );
  });
});
