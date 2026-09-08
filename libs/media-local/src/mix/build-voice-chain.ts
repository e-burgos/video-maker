import type { VoiceTarget } from '@video-maker/timeline-core';

import { buildLoudnormFilter } from '../ffmpeg/build-loudnorm-filter';
import type { LoudnessMeasurement } from '../ffmpeg/parse-loudnorm-json';
import { AUDIO_MIX_SAMPLE_RATE } from './audio-mix-format';

export function buildVoiceChain(target: VoiceTarget, measured?: LoudnessMeasurement): string[] {
  return [buildLoudnormFilter(target, measured), `aresample=${AUDIO_MIX_SAMPLE_RATE}`];
}
