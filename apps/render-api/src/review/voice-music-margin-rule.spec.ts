import { describe, expect, it } from 'vitest';

import { voiceMusicMarginFindings, voiceMusicMargins } from './voice-music-margin-rule';

const SEGMENT = { startSec: 3, endSec: 10, voiceLufs: -14, musicLufs: -16, musicGainDb: -18 };

describe('voice-music-margin with sound effects', () => {
  it('keeps the margin unchanged when no sound effect plays in the segment', () => {
    const [margin] = voiceMusicMargins([SEGMENT, { ...SEGMENT, sfx: [] }].slice(1));

    expect(margin?.marginDb).toBe(20);
    expect(margin?.cause).toBe('music');
  });

  it('adds sound effects to the music as a sum of powers', () => {
    const [margin] = voiceMusicMargins([{ ...SEGMENT, sfx: [{ lufs: -16, gainDb: -18 }] }]);

    expect(margin?.marginDb).toBeCloseTo(20 - 10 * Math.log10(2), 5);
  });

  it('blames the sound effect and proposes lowering it when it breaks the margin', () => {
    const margins = voiceMusicMargins([{ ...SEGMENT, sfx: [{ lufs: -16, gainDb: -4 }] }]);

    const [finding] = voiceMusicMarginFindings(margins);
    expect(finding?.severity).toBe('critical');
    expect(finding?.message).toContain('efectos de sonido');
    expect(finding?.proposedFix).toContain('Bajar el efecto de sonido');
    expect(finding?.timeRange).toEqual({ startSec: 3, endSec: 10 });
  });

  it('still blames the music when the music dominates the effects', () => {
    const margins = voiceMusicMargins([{ ...SEGMENT, musicGainDb: -6, sfx: [{ lufs: -16, gainDb: -30 }] }]);

    const [finding] = voiceMusicMarginFindings(margins);
    expect(finding?.proposedFix).toContain('Bajar la música');
  });

  it('measures sound effects even when the segment has no music', () => {
    const margins = voiceMusicMargins([{ ...SEGMENT, musicLufs: null, sfx: [{ lufs: -16, gainDb: -2 }] }]);

    expect(margins[0]?.marginDb).toBe(4);
    expect(margins[0]?.cause).toBe('sound-effects');
  });

  it('emits nothing when the voice is not measured', () => {
    expect(voiceMusicMargins([{ ...SEGMENT, voiceLufs: null, sfx: [{ lufs: -16, gainDb: 0 }] }])).toEqual([]);
  });
});
