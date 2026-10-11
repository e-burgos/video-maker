import type { VoiceEnergy, VoicePace } from '@video-maker/timeline-core';

import type { TranslationKey } from '../i18n/messages-en';

export const PACE_KEYS: Readonly<Record<VoicePace, TranslationKey>> = {
  slow: 'voiceDirection.pace.slow',
  normal: 'voiceDirection.pace.normal',
  fast: 'voiceDirection.pace.fast',
};

export const ENERGY_KEYS: Readonly<Record<VoiceEnergy, TranslationKey>> = {
  calm: 'voiceDirection.energy.calm',
  neutral: 'voiceDirection.energy.neutral',
  lively: 'voiceDirection.energy.lively',
};
