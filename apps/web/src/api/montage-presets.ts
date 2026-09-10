import { MONTAGE_PRESETS } from './render-api-types';
import type { MontagePresetName } from './render-api-types';

export type MontagePresetDetail = {
  name: MontagePresetName;
  label: string;
  description: string;
};

const DETAIL_BY_PRESET: Readonly<Record<MontagePresetName, Omit<MontagePresetDetail, 'name'>>> = {
  'software-demo': {
    label: 'Software tutorial',
    description: 'Screen recording: quick cuts and full-screen B-roll over the narration.',
  },
  hardware: {
    label: 'Product ad',
    description: 'Advertising: photos first, music present under the voice.',
  },
  educational: {
    label: 'Explainer or class',
    description: 'Sober pacing, B-roll in a window instead of taking the whole frame.',
  },
  recipe: {
    label: 'Step by step',
    description: 'Many short takes in order, one step per shot.',
  },
};

export const MONTAGE_PRESET_DETAILS: readonly MontagePresetDetail[] = MONTAGE_PRESETS.map(
  (name) => ({ name, ...DETAIL_BY_PRESET[name] }),
);

export function montagePresetDetail(name: MontagePresetName): MontagePresetDetail {
  return { name, ...DETAIL_BY_PRESET[name] };
}
