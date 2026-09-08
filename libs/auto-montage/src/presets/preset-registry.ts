import { MontageInputError } from '../errors/montage-input-error';
import { educationalPreset } from './educational.preset';
import { hardwarePreset } from './hardware.preset';
import type { MontagePreset, MontagePresetName } from './montage-preset';
import { recipePreset } from './recipe.preset';
import { softwareDemoPreset } from './software-demo.preset';

export const MONTAGE_PRESETS: Readonly<Record<MontagePresetName, MontagePreset>> = {
  'software-demo': softwareDemoPreset,
  hardware: hardwarePreset,
  recipe: recipePreset,
  educational: educationalPreset,
};

function isMontagePresetName(value: string): value is MontagePresetName {
  return Object.prototype.hasOwnProperty.call(MONTAGE_PRESETS, value);
}

export function resolveMontagePreset(
  nameOrPreset: MontagePresetName | MontagePreset,
  projectRoot: string,
): MontagePreset {
  if (typeof nameOrPreset !== 'string') {
    return nameOrPreset;
  }

  if (!isMontagePresetName(nameOrPreset)) {
    throw new MontageInputError({ projectRoot, reason: 'unknown-preset' });
  }

  return MONTAGE_PRESETS[nameOrPreset];
}
