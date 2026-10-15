import { describe, expect, it } from 'vitest';

import { MUSIC_FREE_TARGET_LUFS, MUSIC_REFERENCE_LUFS, MUSIC_TRACK_VOLUME, meanVoiceLufs, musicBedLevel, musicUnderVoiceLevel } from './music-levels';

const lufsOf = (level: number): number => MUSIC_REFERENCE_LUFS + 20 * Math.log10(level * MUSIC_TRACK_VOLUME);

describe('music levels', () => {
  it('puts the voice-free music at the free target through the track volume', () => {
    expect(musicBedLevel()).toBe(0.885);
    expect(lufsOf(musicBedLevel())).toBeCloseTo(MUSIC_FREE_TARGET_LUFS, 1);
  });

  it.each([
    ['ElevenLabs voice at -22 LUFS', -22, 0.198],
    ['Piper voice at -25.5 LUFS', -25.5, 0.132],
  ])('keeps the music 16 to 20 dB under a %s', (_label, voiceLufs, level) => {
    expect(musicUnderVoiceLevel(voiceLufs)).toBe(level);
    const margin = voiceLufs - lufsOf(musicUnderVoiceLevel(voiceLufs));
    expect(margin).toBeGreaterThanOrEqual(16);
    expect(margin).toBeLessThanOrEqual(20);
    expect(lufsOf(musicBedLevel())).toBeCloseTo(-27, 1);
  });

  it('never ducks above the bed, even under a very loud voice', () => {
    expect(musicUnderVoiceLevel(-5)).toBe(musicBedLevel());
  });

  it('averages scene loudness by power', () => {
    expect(meanVoiceLufs([-22, -22])).toBeCloseTo(-22, 5);
    expect(meanVoiceLufs([-20, -26])).toBeCloseTo(-22.04, 1);
  });
});
