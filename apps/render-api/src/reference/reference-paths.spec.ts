import { describe, expect, it } from 'vitest';

import {
  referenceAudioPath,
  referenceBriefPath,
  referenceKeyframePath,
  referenceNameFor,
} from './reference-paths';

describe('reference paths', () => {
  it('derives the reference name from the file without directory and extension', () => {
    expect(referenceNameFor('raw/reference/modelo final.mp4')).toBe('modelo final');
    expect(referenceNameFor('raw/reference/a.b.mov')).toBe('a.b');
  });

  it('places the brief, keyframes and audio under work/reference', () => {
    expect(referenceBriefPath('modelo')).toBe('work/reference/modelo.brief.json');
    expect(referenceKeyframePath('modelo', 3)).toBe('work/reference/modelo/scene-03.jpg');
    expect(referenceKeyframePath('modelo', 12)).toBe('work/reference/modelo/scene-12.jpg');
    expect(referenceAudioPath('modelo')).toBe('work/reference/modelo.wav');
  });
});
