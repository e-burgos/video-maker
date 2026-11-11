import { describe, expect, it } from 'vitest';
import { TimelineBumpersSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';

import { bundledPreviewBumperSfx, bundledSfxBank, bundledSfxFileUrl, pickSfxVariant, previewBumperSfx } from './preview-bumper-sfx';
import type { SfxBank } from './preview-bumper-sfx';

const MIX_PICKS: Readonly<Record<string, string>> = {
  'whoosh|42:intro:0': 'whoosh-2',
  'whoosh|42:outro:1': 'whoosh-1',
  'whoosh|x': 'whoosh-3',
  'impact|42:intro:0': 'impact-2',
  'impact|42:outro:1': 'impact-1',
  'impact|x': 'impact-1',
  'shimmer|42:intro:0': 'shimmer-3',
  'shimmer|42:outro:1': 'shimmer-2',
  'shimmer|x': 'shimmer-3',
  'click|42:intro:0': 'click-1',
  'click|42:outro:1': 'click-3',
  'click|x': 'click-3',
};

function requireBank(): SfxBank {
  if (bundledSfxBank === null) throw new Error('the sfx bank is not bundled');
  return bundledSfxBank;
}

const bank = requireBank();

function timelineWith(bumpers: unknown): Timeline {
  return {
    id: 'timeline-preview',
    format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
    durationFrames: 300,
    audioMix: { voice: { integratedLufs: -14 } },
    assets: [],
    bumpers: TimelineBumpersSchema.parse(bumpers),
  } as unknown as Timeline;
}

const ROTATING = { intro: { enabled: true, reveal: 'wipe', background: 'noise' }, outro: { enabled: true, reveal: 'pop', background: 'shapes', caption: 'acme.test' }, style: { rotate: true, seed: 42 } };

describe('previewBumperSfx', () => {
  it('elige la misma variante que pickSfxVariant de la mezcla del máster (valores medidos con motion-graphics)', () => {
    Object.entries(MIX_PICKS).forEach(([key, id]) => {
      const [kind = '', seedKey = ''] = key.split('|');
      expect(pickSfxVariant(bank, kind, seedKey, [])?.id).toBe(id);
    });
  });

  it('arma los cues del intro, el outro y los clicks del remate con url, momento y volumen', () => {
    const cues = previewBumperSfx(timelineWith(ROTATING), bank, (file) => `/sfx/${file}`);

    expect(cues[0]).toMatchObject({ atMs: 0 });
    expect(cues[0]?.src).toMatch(/^\/sfx\/whoosh-\d\.mp3$/u);
    expect(cues[1]?.src).toMatch(/^\/sfx\/impact-\d\.mp3$/u);
    expect(cues.filter((cue) => /click-\d/u.test(cue.src))).toHaveLength(3);
    cues.forEach((cue) => {
      expect(cue.volume).toBeGreaterThan(0);
      expect(cue.volume).toBeLessThanOrEqual(1);
    });
  });

  it('sin rotación ni efecto elegido no suena nada', () => {
    expect(previewBumperSfx(timelineWith({ intro: { enabled: true } }), bank, (file) => file)).toEqual([]);
  });

  it('empaqueta el banco y sus archivos con la web', () => {
    expect(bundledSfxBank?.sfx.length).toBe(18);
    expect(bundledSfxFileUrl('whoosh-1.mp3')).toBeDefined();
    expect(bundledPreviewBumperSfx(timelineWith(ROTATING)).length).toBeGreaterThan(0);
  });
});
