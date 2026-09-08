import { describe, expect, it } from 'vitest';

import type { AudioClip, AudioMixPlan } from '@video-maker/timeline-core';

import { buildMusicBedChain } from './build-music-bed-chain';

const FPS = 30;
const VIDEO_DURATION_FRAMES = 210;

const THREE_KEYFRAME_AUTOMATION = [
  { frame: 0, gainDb: -12 },
  { frame: 30, gainDb: -24 },
  { frame: 60, gainDb: -12 },
];

const THREE_KEYFRAME_EXPRESSION =
  "volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,1)*((-12)+(-12)*(t-0))+gte(t,1)*lt(t,2)*((-24)+(12)*(t-1))+gte(t,2)*(-12))/20))':eval=frame";

function musicClip(overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id: 'music-0',
    assetId: 'music-1',
    from: 0,
    durationFrames: VIDEO_DURATION_FRAMES,
    trimStartMs: 0,
    gainDb: -12,
    ...overrides,
  };
}

function musicPlan(automation: AudioMixPlan['automation'] = []): AudioMixPlan {
  return {
    voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
    music: { baseGainDb: -12, duckedGainDb: -24, attackMs: 150, releaseMs: 400, holdMs: 250 },
    automation,
  };
}

describe('buildMusicBedChain', () => {
  it('con automation no vacia emite solo el nodo de automatizacion, ignorando clip.gainDb (D-05)', () => {
    const chain = buildMusicBedChain(musicPlan(THREE_KEYFRAME_AUTOMATION), {
      clip: musicClip({ gainDb: -6 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain[0]).toBe(THREE_KEYFRAME_EXPRESSION);
    expect(chain.filter((filter) => filter.startsWith('volume='))).toHaveLength(1);
  });

  it('con automation vacia emite solo la ganancia constante del clip (D-05)', () => {
    const chain = buildMusicBedChain(musicPlan([]), {
      clip: musicClip({ gainDb: -12 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain[0]).toBe('volume=0.251188643');
    expect(chain.filter((filter) => filter.startsWith('volume='))).toHaveLength(1);
  });

  it('con automation vacia y gainDb 0 no emite ningun nodo de ganancia (identidad, D-05)', () => {
    const chain = buildMusicBedChain(musicPlan([]), {
      clip: musicClip({ gainDb: 0 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain).toEqual(['apad', 'atrim=end=7']);
  });

  it('nunca encadena la ganancia constante despues de la automatizacion', () => {
    const chain = buildMusicBedChain(musicPlan(THREE_KEYFRAME_AUTOMATION), {
      clip: musicClip({ gainDb: -18 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain).not.toContain('volume=0.125892541');
  });

  it('con fadeInFrames y fadeOutFrames emite los dos afade con st/d exactos (CA-003)', () => {
    const chain = buildMusicBedChain(musicPlan([]), {
      clip: musicClip({ gainDb: 0, fadeInFrames: 15, fadeOutFrames: 30 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain).toEqual([
      'afade=t=in:st=0:d=0.5',
      'afade=t=out:st=6:d=1',
      'apad',
      'atrim=end=7',
    ]);
  });

  it('sin fadeInFrames ni fadeOutFrames no emite ningun afade (CA-003)', () => {
    const chain = buildMusicBedChain(musicPlan([]), {
      clip: musicClip({ gainDb: -12 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain).toEqual(['volume=0.251188643', 'apad', 'atrim=end=7']);
  });

  it('el fixture completo de §9.2 del architect.md da la cadena exacta', () => {
    const NINE_KEYFRAME_AUTOMATION = [
      { frame: 0, gainDb: -12 },
      { frame: 26, gainDb: -12 },
      { frame: 30, gainDb: -24 },
      { frame: 98, gainDb: -24 },
      { frame: 110, gainDb: -12 },
      { frame: 146, gainDb: -12 },
      { frame: 150, gainDb: -24 },
      { frame: 188, gainDb: -24 },
      { frame: 200, gainDb: -12 },
    ];

    const chain = buildMusicBedChain(musicPlan(NINE_KEYFRAME_AUTOMATION), {
      clip: musicClip({ gainDb: -12, fadeInFrames: 15, fadeOutFrames: 30 }),
      fps: FPS,
      videoDurationFrames: VIDEO_DURATION_FRAMES,
    });

    expect(chain[1]).toBe('afade=t=in:st=0:d=0.5');
    expect(chain[2]).toBe('afade=t=out:st=6:d=1');
    expect(chain[3]).toBe('apad');
    expect(chain[4]).toBe('atrim=end=7');
    expect(chain).toHaveLength(5);
  });
});
