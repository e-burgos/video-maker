import { SFX_KINDS, TITLE_STYLES } from '@video-maker/motion-graphics';
import type { SfxBank } from '@video-maker/motion-graphics';
import { LOGO_BUMPER_BACKGROUNDS, LOGO_BUMPER_REVEALS, OUTPUT_PRESETS } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { describeVideoMakerCapabilities } from './describe-video-maker-capabilities';

const BANK: SfxBank = {
  version: 1,
  referenceMomentaryLufs: -20,
  sfx: [
    {
      id: 'whoosh-1',
      kind: 'whoosh',
      file: 'whoosh-1.wav',
      title: 'Whoosh',
      author: 'someone',
      license: 'CC0',
      sourceUrl: 'https://example.com/whoosh',
      durationMs: 900,
      peakMs: 300,
      momentaryMaxLufs: -18,
      truePeakDbtp: -2,
    },
  ],
};

describe('describeVideoMakerCapabilities', () => {
  it('derives every list from the engine constants', () => {
    const capabilities = describeVideoMakerCapabilities({ sfxBank: BANK, voices: [] });

    expect(capabilities.formats).toEqual([...OUTPUT_PRESETS]);
    expect(capabilities.bumpers.backgrounds).toEqual([...LOGO_BUMPER_BACKGROUNDS]);
    expect(capabilities.bumpers.reveals).toEqual([...LOGO_BUMPER_REVEALS]);
    expect(capabilities.motion.titleStyles).toEqual([...TITLE_STYLES]);
    expect(capabilities.sfx.kinds).toEqual([...SFX_KINDS]);
  });

  it('lists the montage presets, transitions and text overlay kinds', () => {
    const capabilities = describeVideoMakerCapabilities({ sfxBank: null, voices: [] });

    expect(capabilities.montage.presets).toContain('software-demo');
    expect(capabilities.montage.transitions.kinds).toContain('whip-pan');
    expect(capabilities.montage.transitions.directions.length).toBeGreaterThan(0);
    expect(capabilities.motion.sceneExits).toContain('iris');
    expect(capabilities.textOverlays.kinds).toEqual(['lower-third', 'chapter-title', 'kinetic-text']);
    expect(capabilities.textOverlays.variantsByKind['lower-third']).toContain('accent-bar');
  });

  it('reports the bank entries and the voices it receives', () => {
    const voice = { id: 'v1', label: 'Daniela', engine: 'piper', language: 'es-AR', isDefault: true };
    const capabilities = describeVideoMakerCapabilities({ sfxBank: BANK, voices: [voice] });

    expect(capabilities.sfx.bank).toEqual([{ id: 'whoosh-1', kind: 'whoosh', durationMs: 900, peakMs: 300 }]);
    expect(capabilities.voices).toEqual([voice]);
    expect(capabilities.assetRoles).toContain('logo');
    expect(capabilities.jobKinds).toContain('motion');
  });

  it('answers with no bank entries when there is no bank', () => {
    expect(describeVideoMakerCapabilities({ sfxBank: null, voices: [] }).sfx.bank).toEqual([]);
  });
});
