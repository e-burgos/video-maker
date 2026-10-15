export const MUSIC_TRACK_VOLUME = 0.8;
export const MUSIC_REFERENCE_LUFS = -24;
export const MUSIC_FREE_TARGET_LUFS = -27;
export const MUSIC_UNDER_VOICE_MARGIN_DB = 18;

const roundLevel = (value: number): number => Math.round(value * 1000) / 1000;
const dbToGain = (db: number): number => 10 ** (db / 20);
const levelForLufs = (targetLufs: number): number => roundLevel(dbToGain(targetLufs - MUSIC_REFERENCE_LUFS) / MUSIC_TRACK_VOLUME);

export function musicBedLevel(): number {
  return levelForLufs(MUSIC_FREE_TARGET_LUFS);
}

export function musicUnderVoiceLevel(voiceLufs: number): number {
  return Math.min(levelForLufs(voiceLufs - MUSIC_UNDER_VOICE_MARGIN_DB), musicBedLevel());
}

export function meanVoiceLufs(sceneLufs: readonly number[]): number {
  const meanPower = sceneLufs.reduce((sum, lufs) => sum + 10 ** (lufs / 10), 0) / sceneLufs.length;
  return 10 * Math.log10(meanPower);
}
