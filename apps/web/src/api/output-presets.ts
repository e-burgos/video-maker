import type { OutputPreset } from '@video-maker/timeline-core';
import type { TranslationKey } from '../i18n/messages-en';

export const OUTPUT_PRESETS = [
  'reels-9x16',
  'tiktok-9x16',
  'shorts-9x16',
  'youtube-16x9',
] as const satisfies readonly OutputPreset[];

export type OutputPresetDetail = {
  name: OutputPreset;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
};

export function outputPresetDetail(name: OutputPreset): OutputPresetDetail {
  return {
    name,
    labelKey: `outputPreset.${name}.label` as TranslationKey,
    descriptionKey: `outputPreset.${name}.description` as TranslationKey,
  };
}

export const OUTPUT_PRESET_DETAILS: readonly OutputPresetDetail[] =
  OUTPUT_PRESETS.map(outputPresetDetail);
