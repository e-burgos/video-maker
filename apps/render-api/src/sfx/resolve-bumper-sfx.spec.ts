import { parseSfxBank } from '@video-maker/motion-graphics';
import { TimelineBumpersSchema } from '@video-maker/timeline-core';
import type { Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { resolveBumperSfx } from './resolve-bumper-sfx';

const ENTRY = { title: 't', author: 'a', sourceUrl: 'https://freesound.org/s/1', truePeakDbtp: -3 };
const BANK = parseSfxBank({
  version: 1,
  referenceMomentaryLufs: -18,
  sfx: [
    { ...ENTRY, id: 'whoosh-1', kind: 'whoosh', file: 'whoosh-1.mp3', license: 'CC0', durationMs: 580, momentaryMaxLufs: -18 },
    { ...ENTRY, id: 'whoosh-2', kind: 'whoosh', file: 'whoosh-2.mp3', license: 'CC0', durationMs: 690, momentaryMaxLufs: -19 },
    { ...ENTRY, id: 'impact-1', kind: 'impact', file: 'impact-1.mp3', license: 'CC BY 4.0', durationMs: 2080, momentaryMaxLufs: -18 },
    { ...ENTRY, id: 'impact-2', kind: 'impact', file: 'impact-2.mp3', license: 'CC BY 4.0', durationMs: 1660, momentaryMaxLufs: -18 },
    { ...ENTRY, id: 'click-1', kind: 'click', file: 'click-1.mp3', license: 'CC0', durationMs: 270, momentaryMaxLufs: null },
    { ...ENTRY, id: 'click-2', kind: 'click', file: 'click-2.mp3', license: 'CC0', durationMs: 410, momentaryMaxLufs: -26 },
  ],
});

function timelineWith(bumpers: unknown, assets: unknown[] = []): Timeline {
  return {
    id: 'video-a',
    format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
    durationFrames: 300,
    assets,
    audioMix: { voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 } },
    bumpers: TimelineBumpersSchema.parse(bumpers),
  } as unknown as Timeline;
}

describe('resolveBumperSfx', () => {
  it('turns each automatic cue into a bank file whose gain lands the effect gainDb under the voice target', () => {
    const { cues, used } = resolveBumperSfx(
      timelineWith({ intro: { enabled: true, reveal: 'wipe' }, outro: { enabled: true, reveal: 'pop' }, style: { rotate: true } }),
      BANK,
      '/assets',
    );

    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ atMs: 0, fadeOutMs: 200 });
    expect(cues[0]?.path).toMatch(/^\/assets\/sfx-bank\/whoosh-[12]\.mp3$/u);
    const whoosh = used.find((entry) => entry.kind === 'whoosh');
    expect(cues[0]?.gainDb).toBeCloseTo(-14 - 14 - (whoosh?.momentaryMaxLufs ?? -18), 5);
    expect(cues[1]).toMatchObject({ atMs: 12_330, gainDb: -8, fadeOutMs: 250 });
    expect(used.map((entry) => entry.kind)).toEqual(['whoosh', 'impact']);
  });

  it('never repeats a click variant back to back and measures unmeasured clicks against the bank reference', () => {
    const { cues } = resolveBumperSfx(
      timelineWith({ intro: { enabled: false }, outro: { enabled: true, sfxKind: 'click', caption: 'abc' }, style: { rotate: true } }),
      BANK,
      '/assets',
    );

    const clickPaths = cues.map((cue) => cue.path);
    clickPaths.slice(1).forEach((path, index) => expect(path).not.toBe(clickPaths[index]));
    const unmeasured = cues.find((cue) => cue.path.endsWith('click-1.mp3'));
    if (unmeasured !== undefined) expect(unmeasured.gainDb).toBe(-14 - 24 + 18);
  });

  it('plays explicit cues from the timeline assets with their own gain and skips unknown assets', () => {
    const { cues, used } = resolveBumperSfx(
      timelineWith(
        { intro: { enabled: true, sfx: [{ atMs: 100, assetId: 'boom', gainDb: -6, fadeInMs: 10 }, { atMs: 0, assetId: 'missing', gainDb: -6 }] } },
        [{ id: 'boom', path: '/project/raw/audio/boom.wav', durationMs: 900 }],
      ),
      BANK,
      '/assets',
    );

    expect(cues).toEqual([{ path: '/project/raw/audio/boom.wav', atMs: 100, gainDb: -6, durationMs: 900, fadeInMs: 10 }]);
    expect(used).toEqual([]);
  });

  it('reads an explicit cue whose assetId is a bank id from the bank and credits it', () => {
    const { cues, used } = resolveBumperSfx(
      timelineWith({ intro: { enabled: true, sfx: [{ atMs: 50, assetId: 'impact-2', gainDb: -10, fadeOutMs: 200 }] } }),
      BANK,
      '/assets',
    );

    expect(cues).toEqual([{ path: '/assets/sfx-bank/impact-2.mp3', atMs: 50, gainDb: -10, durationMs: 1660, fadeOutMs: 200 }]);
    expect(used.map((entry) => entry.id)).toEqual(['impact-2']);
  });

  it('picks the variant from the bumper style seed, not from the timeline id', () => {
    const bumpers = { intro: { enabled: true, reveal: 'wipe', background: 'gradient' }, outro: { enabled: false }, style: { rotate: true, seed: 77 } };
    const first = resolveBumperSfx(timelineWith(bumpers), BANK, '/assets').cues[0]?.path;
    const renamed = resolveBumperSfx({ ...timelineWith(bumpers), id: 'another-video' } as Timeline, BANK, '/assets').cues[0]?.path;

    expect(renamed).toBe(first);
  });

  it('skips an automatic cue whose kind the bank does not have instead of failing the render', () => {
    const { cues } = resolveBumperSfx(
      timelineWith({ intro: { enabled: true, sfxKind: 'shimmer' }, outro: { enabled: true, sfxKind: 'whoosh' }, style: { rotate: true } }),
      BANK,
      '/assets',
    );

    expect(cues.map((cue) => cue.path.split('/').at(-1)?.split('-')[0])).toEqual(['whoosh']);
  });
});
