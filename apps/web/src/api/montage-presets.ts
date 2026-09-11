import { MONTAGE_PRESETS } from './render-api-types';
import type { MontagePresetName } from './render-api-types';
import type { TranslationKey } from '../i18n/messages-en';

export type MontagePresetDetail = {
  name: MontagePresetName;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
};

export function montagePresetDetail(name: MontagePresetName): MontagePresetDetail {
  return {
    name,
    labelKey: `montagePreset.${name}.label` as TranslationKey,
    descriptionKey: `montagePreset.${name}.description` as TranslationKey,
  };
}

export const MONTAGE_PRESET_DETAILS: readonly MontagePresetDetail[] =
  MONTAGE_PRESETS.map(montagePresetDetail);
