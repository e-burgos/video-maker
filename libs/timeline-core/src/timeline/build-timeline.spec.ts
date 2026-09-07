import { describe, expect, it } from 'vitest';

import { ca013Assets, arollAsset } from '../__fixtures__/assets';
import { ca013Edl, ca013Format } from '../__fixtures__/edl';
import { DEFAULT_AUDIO_MIX_PLAN, DEFAULT_MUSIC_MIX, planDucking } from '../ducking/plan-ducking';
import type { EditDecisionList } from '../schemas/edit-decision-list.schema';
import { TimelineSchema } from '../schemas/timeline.schema';
import { TimelineBuildError, buildTimeline } from './build-timeline';
import type { MusicInput } from './build-timeline';

function parseOrThrow(timeline: unknown) {
  const result = TimelineSchema.safeParse(timeline);
  expect(result.success).toBe(true);
  return result;
}

describe('buildTimeline (CA-013)', () => {
  it('produce una Timeline válida que respeta el schema', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);
    parseOrThrow(timeline);
  });

  it('calcula durationFrames como suma de keeps menos los frames de la transición', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);
    expect(timeline.durationFrames).toBe(265);
  });

  it('genera dos clips A-roll con from/duration/trimStartMs/scale exactos', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.tracks.aroll).toHaveLength(2);
    expect(timeline.tracks.aroll[0]).toMatchObject({
      id: 'aroll-0001',
      assetId: 'aroll-cam-01',
      from: 0,
      durationFrames: 122,
      trimStartMs: 0,
      muted: true,
      transform: { scale: 1, translateX: 0, translateY: 0 },
    });
    expect(timeline.tracks.aroll[1]).toMatchObject({
      id: 'aroll-0002',
      assetId: 'aroll-cam-01',
      from: 113,
      durationFrames: 152,
      trimStartMs: 4920,
      muted: true,
      transform: { scale: 1.15, translateX: 0, translateY: 0 },
    });
  });

  it('espeja el A-roll en la pista de voz sin ganancia aplicada', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.tracks.voice).toHaveLength(2);
    timeline.tracks.voice.forEach((voiceClip, index) => {
      const arollClip = timeline.tracks.aroll[index];
      expect(arollClip).toBeDefined();
      expect(voiceClip).toMatchObject({
        assetId: arollClip?.assetId,
        from: arollClip?.from,
        durationFrames: arollClip?.durationFrames,
        trimStartMs: arollClip?.trimStartMs,
        gainDb: 0,
      });
    });
  });

  it('ubica el B-roll relativo al keep que lo contiene, no vía remapMsAfterCuts', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.tracks.broll).toHaveLength(1);
    expect(timeline.tracks.broll[0]).toMatchObject({
      assetId: 'broll-shot-01',
      from: 121,
      durationFrames: 60,
      fit: 'cover',
      muted: true,
      trimStartMs: 0,
    });
  });

  it('ubica los tres caption-groups con frames relativos y emphasisIndex explícito', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.tracks.captions).toHaveLength(3);

    const [cap1, cap2, cap3] = timeline.tracks.captions;
    expect(cap1).toMatchObject({ from: 15, durationFrames: 33, emphasisIndex: 1 });
    expect(cap1?.words).toEqual([
      { text: 'te', fromFrame: 0, durationFrames: 6 },
      { text: 'muestro', fromFrame: 7, durationFrames: 11 },
      { text: 'cómo', fromFrame: 19, durationFrames: 14 },
    ]);

    expect(cap2).toMatchObject({ from: 51, durationFrames: 33, emphasisIndex: 2 });
    expect(cap2?.words).toEqual([
      { text: 'editar', fromFrame: 0, durationFrames: 11 },
      { text: 'un', fromFrame: 11, durationFrames: 3 },
      { text: 'video', fromFrame: 15, durationFrames: 18 },
    ]);

    expect(cap3).toMatchObject({ from: 115, durationFrames: 30, emphasisIndex: 0 });
    expect(cap3?.words).toEqual([
      { text: 'nada', fromFrame: 0, durationFrames: 9 },
      { text: 'totalmente', fromFrame: 10, durationFrames: 20 },
    ]);
  });

  it('emite el box de cada caption como el interior del safe zone del formato (D-10)', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    const expectedBox = { x: 60, y: 220, width: 880, height: 1300 };
    timeline.tracks.captions.forEach((caption) => {
      expect(caption.box).toEqual(expectedBox);
    });
  });

  it('genera la transición con los clips vecinos correctos y duración en frames', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.transitions).toHaveLength(1);
    expect(timeline.transitions?.[0]).toEqual({
      betweenClipIds: ['aroll-0001', 'aroll-0002'],
      kind: 'fade',
      durationFrames: 9,
      timing: { type: 'spring', damping: 200, stiffness: 100, mass: 1 },
    });
  });

  it('sin música: tracks.music vacío y audioMix = DEFAULT_AUDIO_MIX_PLAN', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.tracks.music).toEqual([]);
    expect(timeline.audioMix).toEqual(DEFAULT_AUDIO_MIX_PLAN);
  });

  it('no comparte estado entre llamadas: safeZone y audioMix son objetos propios de cada Timeline', () => {
    const first = buildTimeline(ca013Edl, ca013Assets);
    first.safeZone.top = 0;
    first.audioMix.music.baseGainDb = 0;
    first.audioMix.voice.integratedLufs = 0;

    const second = buildTimeline(ca013Edl, ca013Assets);

    expect(second.safeZone).toEqual({ top: 220, bottom: 400, left: 60, right: 140 });
    expect(second.audioMix).toEqual(DEFAULT_AUDIO_MIX_PLAN);
    expect(DEFAULT_AUDIO_MIX_PLAN.music).toEqual(DEFAULT_MUSIC_MIX);
  });

  it('propaga el formato y el safeZone del EDL', () => {
    const timeline = buildTimeline(ca013Edl, ca013Assets);

    expect(timeline.format).toEqual(ca013Format);
    expect(timeline.safeZone).toEqual({ top: 220, bottom: 400, left: 60, right: 140 });
    expect(timeline.id).toBe('timeline-aroll-cam-01');
  });
});

describe('buildTimeline — música y ducking', () => {
  const duckEdl: EditDecisionList = {
    schemaVersion: 1,
    sourceAssetId: 'aroll-cam-01',
    format: ca013Format,
    generatedBy: { tool: 'fixture', params: {} },
    decisions: [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 5000 },
      { id: 'duck-0001', type: 'duck', startMs: 1000, endMs: 2000, gainDb: -24 },
    ],
  };

  it('con música: convierte los duck en voiceRanges de timeline y delega en planDucking', () => {
    const music: MusicInput = { assetId: 'music-bed-01' };
    const timeline = buildTimeline(duckEdl, ca013Assets, music);

    const expectedAutomation = planDucking(
      [{ startMs: 1000, endMs: 2000 }],
      DEFAULT_MUSIC_MIX,
      30,
    ).automation;

    expect(timeline.audioMix.automation).toEqual(expectedAutomation);
    expect(timeline.audioMix.automation.length).toBeGreaterThan(0);
  });

  it('agrega un único clip de música con los defaults del mix cuando no se pasan overrides', () => {
    const music: MusicInput = { assetId: 'music-bed-01' };
    const timeline = buildTimeline(duckEdl, ca013Assets, music);

    expect(timeline.tracks.music).toHaveLength(1);
    const musicClip = timeline.tracks.music[0];
    expect(musicClip).toMatchObject({
      id: 'music-0001',
      assetId: 'music-bed-01',
      from: 0,
      durationFrames: 150,
      trimStartMs: 0,
      gainDb: DEFAULT_MUSIC_MIX.baseGainDb,
    });
    expect(musicClip).not.toHaveProperty('fadeInFrames');
    expect(musicClip).not.toHaveProperty('fadeOutFrames');
    parseOrThrow(timeline);
  });

  it('respeta los overrides explícitos de MusicInput', () => {
    const music: MusicInput = {
      assetId: 'music-bed-01',
      trimStartMs: 500,
      gainDb: -6,
      fadeInFrames: 10,
      fadeOutFrames: 20,
    };
    const timeline = buildTimeline(duckEdl, ca013Assets, music);

    expect(timeline.tracks.music[0]).toMatchObject({
      trimStartMs: 500,
      gainDb: -6,
      fadeInFrames: 10,
      fadeOutFrames: 20,
    });
    parseOrThrow(timeline);
  });
});

describe('buildTimeline — casos borde', () => {
  it('lanza TimelineBuildError EMPTY_AROLL si el EDL no tiene ninguna decisión keep', () => {
    const emptyEdl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: ca013Format,
      generatedBy: { tool: 'fixture', params: {} },
      decisions: [],
    };

    expect(() => buildTimeline(emptyEdl, ca013Assets)).toThrow(TimelineBuildError);
    try {
      buildTimeline(emptyEdl, ca013Assets);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TimelineBuildError);
      expect((error as InstanceType<typeof TimelineBuildError>).code).toBe('EMPTY_AROLL');
    }
  });

  it('un único keep sin transiciones, B-roll ni captions produce una Timeline mínima válida', () => {
    const singleKeepEdl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: ca013Format,
      generatedBy: { tool: 'fixture', params: {} },
      decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 }],
    };

    const timeline = buildTimeline(singleKeepEdl, [arollAsset]);

    expect(timeline.durationFrames).toBe(60);
    expect(timeline.tracks.aroll).toEqual([
      {
        id: 'aroll-0001',
        assetId: 'aroll-cam-01',
        from: 0,
        durationFrames: 60,
        trimStartMs: 0,
        muted: true,
        transform: { scale: 1, translateX: 0, translateY: 0 },
      },
    ]);
    expect(timeline.tracks.broll).toEqual([]);
    expect(timeline.tracks.captions).toEqual([]);
    expect(timeline.transitions).toEqual([]);
    parseOrThrow(timeline);
  });

  it('una transición más larga que el keep que la precede retrocede el cursor sin lanzar (queda para validateTimeline)', () => {
    const overlappingEdl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: ca013Format,
      generatedBy: { tool: 'fixture', params: {} },
      decisions: [
        { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 },
        { id: 'trans-0001', type: 'transition', atMs: 2000, kind: 'fade', durationMs: 100 },
        { id: 'keep-0002', type: 'keep', startMs: 2000, endMs: 2100 },
        { id: 'trans-0002', type: 'transition', atMs: 2100, kind: 'fade', durationMs: 500 },
        { id: 'keep-0003', type: 'keep', startMs: 2100, endMs: 3000 },
      ],
    };

    const timeline = buildTimeline(overlappingEdl, [arollAsset]);

    expect(timeline.tracks.aroll).toHaveLength(3);
    expect(timeline.tracks.aroll[0]).toMatchObject({ from: 0, durationFrames: 60 });
    expect(timeline.tracks.aroll[1]).toMatchObject({ from: 57, durationFrames: 3 });
    expect(timeline.tracks.aroll[2]).toMatchObject({ from: 45, durationFrames: 27 });
    expect(timeline.durationFrames).toBe(72);
    parseOrThrow(timeline);
  });

  it('ignora una transición cuyo atMs coincide con el primer keep (no tiene keep anterior)', () => {
    const transitionOnFirstKeepEdl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: ca013Format,
      generatedBy: { tool: 'fixture', params: {} },
      decisions: [
        { id: 'trans-0000', type: 'transition', atMs: 0, kind: 'fade', durationMs: 100 },
        { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 },
      ],
    };

    const timeline = buildTimeline(transitionOnFirstKeepEdl, [arollAsset]);

    expect(timeline.transitions).toEqual([]);
    expect(timeline.tracks.aroll[0]).toMatchObject({ from: 0, durationFrames: 60 });
    parseOrThrow(timeline);
  });

  it('un assetId referenciado que no existe en assets se construye igual (lo reporta validateTimeline)', () => {
    const missingAssetEdl: EditDecisionList = {
      schemaVersion: 1,
      sourceAssetId: 'aroll-cam-01',
      format: ca013Format,
      generatedBy: { tool: 'fixture', params: {} },
      decisions: [
        { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 2000 },
        {
          id: 'broll-0001',
          type: 'broll-overlay',
          startMs: 200,
          endMs: 400,
          assetId: 'broll-does-not-exist',
          fit: 'cover',
        },
      ],
    };

    const timeline = buildTimeline(missingAssetEdl, [arollAsset]);

    expect(timeline.tracks.broll).toHaveLength(1);
    expect(timeline.tracks.broll[0]?.assetId).toBe('broll-does-not-exist');
    expect(timeline.assets.some((asset) => asset.id === 'broll-does-not-exist')).toBe(false);
    parseOrThrow(timeline);
  });
});
