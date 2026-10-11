import { describe, expect, it } from 'vitest';

import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { detectSilences, parseSilenceSegments, silenceDetectArgs } from './detect-silence-segments';

const SILENCE_STDERR = `[Parsed_silencedetect_0 @ 0xb3302cd80] silence_start: 0.999955
[Parsed_silencedetect_0 @ 0xb3302cd80] silence_end: 3 | silence_duration: 2.000045
[Parsed_silencedetect_0 @ 0xb3302cd80] silence_start: 8.5
`;

describe('parseSilenceSegments', () => {
  it('pairs silence_start with silence_end and reports the duration', () => {
    expect(parseSilenceSegments(SILENCE_STDERR)).toEqual([{ startSec: 0.999955, endSec: 3, durationSec: 2 }]);
  });

  it('closes a trailing silence with the audio duration', () => {
    expect(parseSilenceSegments(SILENCE_STDERR, 12)).toEqual([
      { startSec: 0.999955, endSec: 3, durationSec: 2 },
      { startSec: 8.5, endSec: 12, durationSec: 3.5 },
    ]);
  });
});

describe('detectSilences', () => {
  it('builds silencedetect with noise floor and minimum duration', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: SILENCE_STDERR, exitCode: 0 } }]);

    const silences = await detectSilences('/a.wav', runner, { minDurationSec: 2.5, noiseDb: -40 });

    expect(silences).toHaveLength(1);
    expect(silenceDetectArgs('/a.wav', { minDurationSec: 2.5, noiseDb: -40 })).toContain(
      'silencedetect=noise=-40dB:d=2.5',
    );
  });
});
