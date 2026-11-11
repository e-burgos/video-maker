import { describe, expect, it } from 'vitest';

import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import { masterLoudnessTarget } from './normalize-master-loudness';
import { masterRetryFor } from './true-peak-guard';

const TARGET = masterLoudnessTarget(DEFAULT_VOICE_TARGET);

describe('masterRetryFor', () => {
  it('lowers the peak ceiling when the AAC encode crosses -1 dBTP', () => {
    expect(masterRetryFor(TARGET, DEFAULT_VOICE_TARGET, TARGET.truePeakDbtp, { truePeakDbtp: 0.06 })).toEqual({
      kind: 'true-peak',
      target: { ...TARGET, truePeakDbtp: -3.56 },
    });
  });

  it('keeps the master when its encoded peak stays under the ceiling, even if the limiter left it a little short of loudness', () => {
    expect(masterRetryFor(TARGET, DEFAULT_VOICE_TARGET, TARGET.truePeakDbtp, { truePeakDbtp: -1.4 })).toEqual({ kind: 'none' });
    expect(masterRetryFor(TARGET, DEFAULT_VOICE_TARGET, TARGET.truePeakDbtp, { truePeakDbtp: -1.5 })).toEqual({ kind: 'none' });
  });
});
