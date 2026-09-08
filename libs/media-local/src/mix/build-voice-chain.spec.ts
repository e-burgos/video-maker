import { describe, expect, it } from 'vitest';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { buildLoudnormFilter } from '../ffmpeg/build-loudnorm-filter';
import type { LoudnessMeasurement } from '../ffmpeg/parse-loudnorm-json';
import { AUDIO_MIX_SAMPLE_RATE } from './audio-mix-format';
import { buildVoiceChain } from './build-voice-chain';

const TARGET: VoiceTarget = { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 };

const MEASURED: LoudnessMeasurement = {
  integratedLufs: -23.45,
  truePeakDbtp: -5.2,
  loudnessRange: 7.6,
  thresholdLufs: -33.99,
  targetOffsetDb: -0.03,
};

describe('buildVoiceChain', () => {
  it('sin measured, el primer elemento es igual al de buildLoudnormFilter de primera pasada (CA-004)', () => {
    expect(buildVoiceChain(TARGET)).toEqual([buildLoudnormFilter(TARGET), `aresample=${AUDIO_MIX_SAMPLE_RATE}`]);
  });

  it('con measured, el primer elemento es igual al de buildLoudnormFilter de segunda pasada (CA-004)', () => {
    expect(buildVoiceChain(TARGET, MEASURED)).toEqual([
      buildLoudnormFilter(TARGET, MEASURED),
      `aresample=${AUDIO_MIX_SAMPLE_RATE}`,
    ]);
  });

  it('el segundo elemento usa AUDIO_MIX_SAMPLE_RATE, siempre "aresample=48000"', () => {
    expect(buildVoiceChain(TARGET)[1]).toBe('aresample=48000');
  });
});
