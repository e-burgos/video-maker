import type { Db, Lufs } from '../types/units';

export const DEFAULT_MUSIC_REFERENCE_LUFS: Lufs = -16;
export const MUSIC_NORMALIZATION_MAX_GAIN_DB = 18;

export function musicNormalizationGainDb(
  measuredLufs: number | undefined,
  referenceLufs: number,
): Db {
  if (measuredLufs === undefined || !Number.isFinite(measuredLufs)) {
    return 0;
  }

  const rawGainDb = referenceLufs - measuredLufs;

  return Math.max(
    -MUSIC_NORMALIZATION_MAX_GAIN_DB,
    Math.min(MUSIC_NORMALIZATION_MAX_GAIN_DB, rawGainDb),
  );
}
