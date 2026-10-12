import { describe, expect, it } from 'vitest';

import { DEFAULT_MUSIC_MIX, planDucking } from './plan-ducking';
import {
  DEFAULT_SEGMENTED_MUSIC_FLOOR_DB,
  planSegmentedMusic,
  segmentedMusicMix,
} from './plan-segmented-music';

const FPS = 30;
const mix = segmentedMusicMix(DEFAULT_MUSIC_MIX);
const gainAt = (automation: readonly { frame: number; gainDb: number }[], ms: number) =>
  automation.find((keyframe) => keyframe.frame === Math.round((ms * FPS) / 1000))?.gainDb;

describe('segmentedMusicMix (US-023-303)', () => {
  it('marca el modo y baja el piso 30 dB bajo el nivel pleno con fundidos de 0,6 s', () => {
    expect(mix).toMatchObject({
      mode: 'segments',
      baseGainDb: -12,
      duckedGainDb: -12 + DEFAULT_SEGMENTED_MUSIC_FLOOR_DB,
      attackMs: 600,
      releaseMs: 600,
      holdMs: 0,
    });
  });

  it('permite configurar el piso y deja intactos los demás ajustes del mix', () => {
    expect(segmentedMusicMix(DEFAULT_MUSIC_MIX, { floorDb: -20 }).duckedGainDb).toBe(-32);
    expect(segmentedMusicMix(DEFAULT_MUSIC_MIX).referenceLufs).toBe(DEFAULT_MUSIC_MIX.referenceLufs);
  });
});

describe('planSegmentedMusic (US-023-303)', () => {
  const voice = [
    { startMs: 1000, endMs: 3000 },
    { startMs: 3500, endMs: 5000 },
    { startMs: 8000, endMs: 10_000 },
  ];

  it('mantiene al piso los huecos de menos de 2 s y los une en un solo tramo hablado', () => {
    const { automation, decisions } = planSegmentedMusic(voice, mix, FPS);

    expect(decisions.map(({ startMs, endMs }) => ({ startMs, endMs }))).toEqual([
      { startMs: 1000, endMs: 5000 },
      { startMs: 8000, endMs: 10_000 },
    ]);
    expect(gainAt(automation, 3200)).toBeUndefined();
    expect(gainAt(automation, 1000)).toBe(-42);
    expect(gainAt(automation, 5000)).toBe(-42);
  });

  it('sube a plena en el hueco de 3 s y la baja con fundidos de 0,6 s antes de volver a hablar', () => {
    const { automation } = planSegmentedMusic(voice, mix, FPS);

    expect(gainAt(automation, 5600)).toBe(-12);
    expect(gainAt(automation, 7400)).toBe(-12);
    expect(gainAt(automation, 8000)).toBe(-42);
  });

  it('suena plena en la intro y en el cierre', () => {
    const { automation } = planSegmentedMusic(voice, mix, FPS);

    expect(automation[0]).toEqual({ frame: 0, gainDb: -12 });
    expect(gainAt(automation, 400)).toBe(-12);
    expect(automation.at(-1)?.gainDb).toBe(-12);
  });

  it('sin voz no automatiza nada', () => {
    expect(planSegmentedMusic([], mix, FPS)).toEqual({ automation: [], decisions: [] });
  });

  it('el modo bed (planDucking) sigue produciendo la misma automatización que antes', () => {
    const before = planDucking(voice, DEFAULT_MUSIC_MIX, FPS);
    expect(planDucking(voice, { ...DEFAULT_MUSIC_MIX }, FPS)).toEqual(before);
    expect(before.automation.some((keyframe) => keyframe.gainDb === -42)).toBe(false);
  });
});
