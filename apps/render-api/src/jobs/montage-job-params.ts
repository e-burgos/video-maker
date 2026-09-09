import { MONTAGE_PRESETS } from '@video-maker/auto-montage';
import type { MontagePresetName } from '@video-maker/auto-montage';

import { PipelineStageError } from '../errors/pipeline-stage-error';

const MONTAGE_PRESET_NAMES = Object.keys(MONTAGE_PRESETS) as readonly MontagePresetName[];

const DEFAULT_MONTAGE_PRESET: MontagePresetName = 'software-demo';
const DEFAULT_MONTAGE_SEED = 0;
const DEFAULT_MONTAGE_OVERWRITE = false;

function isMontagePresetName(value: unknown): value is MontagePresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MONTAGE_PRESETS, value);
}

export function parseMontagePreset(value: unknown): MontagePresetName {
  if (value === undefined) {
    return DEFAULT_MONTAGE_PRESET;
  }

  if (!isMontagePresetName(value)) {
    throw new PipelineStageError({
      code: 'MONTAGE_PRESET_INVALID',
      stage: null,
      expected: `one of ${MONTAGE_PRESET_NAMES.join(', ')}`,
    });
  }

  return value;
}

export function parseMontageSeed(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_MONTAGE_SEED;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new PipelineStageError({
      code: 'MONTAGE_SEED_INVALID',
      stage: null,
      expected: 'a non-negative integer',
    });
  }

  return value;
}

export function parseMontageOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_MONTAGE_OVERWRITE;
  }

  if (typeof value !== 'boolean') {
    throw new PipelineStageError({
      code: 'MONTAGE_OVERWRITE_INVALID',
      stage: null,
      expected: 'a boolean',
    });
  }

  return value;
}
