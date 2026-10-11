import { describe, expect, it } from 'vitest';

import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import {
  blackDetectArgs,
  detectBlackSegments,
  detectFrozenSegments,
  freezeDetectArgs,
  parseBlackDetect,
  parseFreezeDetect,
} from './detect-video-defects';

const BLACK_STDERR = `Input #0, lavfi, from 'color=c=black':
[Parsed_blackdetect_0 @ 0xa5702cf00] black_start:0 black_end:2 black_duration:2
[Parsed_blackdetect_0 @ 0xa5702cf00] black_start:10.5 black_end:12.04 black_duration:1.54
`;

const FREEZE_STDERR = `[Parsed_freezedetect_0 @ 0xbf6c10e40] lavfi.freezedetect.freeze_start: 0
[Parsed_freezedetect_0 @ 0xbf6c10e40] lavfi.freezedetect.freeze_duration: 3
[Parsed_freezedetect_0 @ 0xbf6c10e40] lavfi.freezedetect.freeze_end: 3
[Parsed_freezedetect_0 @ 0xbf6c10e40] lavfi.freezedetect.freeze_start: 20
`;

describe('parseBlackDetect', () => {
  it('returns every black range with its duration', () => {
    expect(parseBlackDetect(BLACK_STDERR)).toEqual([
      { startSec: 0, endSec: 2, durationSec: 2 },
      { startSec: 10.5, endSec: 12.04, durationSec: 1.54 },
    ]);
  });

  it('returns nothing when no black frames were found', () => {
    expect(parseBlackDetect('frame=  150 fps=0.0')).toEqual([]);
  });
});

describe('parseFreezeDetect', () => {
  it('pairs freeze_start with freeze_end', () => {
    expect(parseFreezeDetect(FREEZE_STDERR)).toEqual([{ startSec: 0, endSec: 3, durationSec: 3 }]);
  });

  it('closes a freeze that runs until the end of the video', () => {
    expect(parseFreezeDetect(FREEZE_STDERR, 30)).toEqual([
      { startSec: 0, endSec: 3, durationSec: 3 },
      { startSec: 20, endSec: 30, durationSec: 10 },
    ]);
  });
});

describe('detection arguments', () => {
  it('builds blackdetect with the minimum duration and pixel threshold', () => {
    expect(blackDetectArgs('/v.mp4', { minDurationSec: 1 })).toEqual([
      '-hide_banner', '-nostats', '-i', '/v.mp4', '-an', '-vf', 'blackdetect=d=1:pix_th=0.1', '-f', 'null', '-',
    ]);
  });

  it('builds freezedetect with the noise floor', () => {
    expect(freezeDetectArgs('/v.mp4', { minDurationSec: 8, noiseDb: -50 })).toContain('freezedetect=n=-50dB:d=8');
  });
});

describe('detectBlackSegments / detectFrozenSegments', () => {
  it('runs ffmpeg and parses its stderr', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', argsPattern: [/blackdetect/], response: { stderr: BLACK_STDERR, exitCode: 0 } },
      { bin: 'ffmpeg', argsPattern: [/freezedetect/], response: { stderr: FREEZE_STDERR, exitCode: 0 } },
    ]);

    const black = await detectBlackSegments('/v.mp4', runner, { minDurationSec: 1 });
    const frozen = await detectFrozenSegments('/v.mp4', runner, { minDurationSec: 8, videoDurationSec: 30 });

    expect(black).toHaveLength(2);
    expect(frozen).toHaveLength(2);
  });
});
