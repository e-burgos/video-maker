import type { MediaAsset, Timeline } from '@video-maker/timeline-core';
import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';
import { exampleAssets, exampleEdl } from '../__fixtures__/example-edl';
import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import { timelineToSequenceProps } from './timeline-to-sequence-props';

describe('timelineToSequenceProps', () => {
  const timeline = buildExampleTimeline('reels-9x16');
  const plan = timelineToSequenceProps(timeline);

  it('expone el formato y la duración de la Timeline sin recalcular', () => {
    expect(plan.durationInFrames).toBe(265);
    expect(plan.fps).toBe(30);
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
  });

  it('mapea cada clip de A-roll con su from/durationInFrames tal cual', () => {
    expect(plan.aroll).toHaveLength(2);

    expect(plan.aroll[0]).toMatchObject({
      from: 0,
      durationInFrames: 122,
      trimStartMs: 0,
      trimBefore: 0,
      muted: true,
    });
    expect(plan.aroll[0]?.transform.scale).toBe(1);

    expect(plan.aroll[1]).toMatchObject({
      from: 113,
      durationInFrames: 152,
      trimStartMs: 4920,
      trimBefore: 148,
    });
    expect(plan.aroll[1]?.transform.scale).toBe(1.15);
  });

  it('calcula trimBefore desde trimStartMs con msToFrames', () => {
    expect(plan.aroll[1]?.trimBefore).toBe(148);
  });

  it('conserva la suma de frames de la serie de A-roll contra la Timeline', () => {
    const [first, second] = plan.aroll;
    const [transition] = plan.arollTransitions;

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(transition).toBeDefined();
    expect(
      (first?.durationInFrames ?? 0) + (second?.durationInFrames ?? 0) - (transition?.durationInFrames ?? 0),
    ).toBe(timeline.durationFrames);
  });

  it('asocia la transición al par de clipIds exacto que emite buildTimeline', () => {
    expect(plan.arollTransitions).toHaveLength(1);
    expect(plan.arollTransitions[0]).toMatchObject({
      betweenClipIds: ['aroll-0001', 'aroll-0002'],
      kind: 'fade',
      durationInFrames: 9,
    });
    expect(plan.arollTransitions[0]?.timing.type).toBe('spring');
  });

  it('mapea B-roll', () => {
    expect(plan.broll).toHaveLength(1);
    expect(plan.broll[0]).toMatchObject({
      from: 121,
      durationInFrames: 60,
      kind: 'image',
    });
  });

  it('mapea voz y música, con la ganancia de la música sin la automatización', () => {
    expect(plan.voice).toHaveLength(2);
    expect(plan.music).toHaveLength(1);

    expect(plan.music[0]).toMatchObject({ from: 0, durationInFrames: 265, gainDb: -12 });
    expect(plan.music[0]?.volume).toBeCloseTo(0.2512, 4);
    expect(plan.voice[0]?.volume).toBe(1);
  });

  it('resuelve la voz del guion como un asset de audio propio bajo work/ (FIX-e-burgos-007-002)', () => {
    const scriptVoice: MediaAsset = {
      id: 'work/voice/voice.wav',
      kind: 'audio',
      path: 'work/voice/voice.wav',
      durationMs: 10_000,
      probedAt: '2026-09-07T00:00:00.000Z',
    };
    const scriptPlan = timelineToSequenceProps(
      buildTimeline(
        { ...exampleEdl, format: defaultFormat('youtube-16x9') },
        [...exampleAssets, scriptVoice],
        undefined,
        undefined,
        { assetId: scriptVoice.id },
      ),
    );

    expect(scriptPlan.unresolvedAssetIds).toEqual([]);
    expect(scriptPlan.voice.every((clip) => clip.assetId === 'work/voice/voice.wav')).toBe(true);
    expect(scriptPlan.voice[0]?.src).toContain('work/voice/voice.wav');
  });

  it('mapea captions con from/durationInFrames relativos a la Sequence', () => {
    expect(plan.captions).toHaveLength(3);
    expect(plan.captions[0]).toMatchObject({ from: 15, durationInFrames: 33 });
    expect(plan.captions[1]).toMatchObject({ from: 51, durationInFrames: 33 });
    expect(plan.captions[2]).toMatchObject({ from: 115, durationInFrames: 30 });
    expect(plan.captions[0]?.words[0]?.fromFrame).toBe(0);
    expect(plan.captions[0]?.box).not.toBeNull();
  });

  it('CE-1: un assetId sin resolver se omite de su pista y se acumula en unresolvedAssetIds', () => {
    const timelineWithMissingBrollAsset = {
      ...timeline,
      assets: timeline.assets.filter((asset) => asset.id !== 'broll-shot-01'),
    };

    const planWithMissingAsset = timelineToSequenceProps(timelineWithMissingBrollAsset);

    expect(planWithMissingAsset.broll).toEqual([]);
    expect(planWithMissingAsset.unresolvedAssetIds).toEqual(['broll-shot-01']);
    expect(planWithMissingAsset.aroll).toHaveLength(2);
  });

  it('una Timeline sin broll, música ni captions produce arrays vacíos', () => {
    const timelineWithoutOptionalTracks = {
      ...timeline,
      tracks: { ...timeline.tracks, broll: [], music: [], captions: [] },
    };

    const minimalPlan = timelineToSequenceProps(timelineWithoutOptionalTracks);

    expect(minimalPlan.broll).toEqual([]);
    expect(minimalPlan.music).toEqual([]);
    expect(minimalPlan.captions).toEqual([]);
    expect(minimalPlan.aroll).toHaveLength(2);
  });
});

describe('timelineToSequenceProps — normalización de la música y capa de logo (spec-014)', () => {
  const timeline = buildExampleTimeline('reels-9x16');

  function withMusicLoudness(integratedLufs: number | undefined): Timeline {
    return {
      ...timeline,
      assets: timeline.assets.map((asset) =>
        asset.id === 'music-bed-01'
          ? {
              ...asset,
              audio: {
                sampleRate: 44_100,
                channels: 2,
                codec: 'mp3',
                ...(integratedLufs === undefined ? {} : { integratedLufs }),
              },
            }
          : asset,
      ),
    };
  }

  it('deriva normalizationGainDb del asset y del referenceLufs del plan', () => {
    const plan = timelineToSequenceProps(withMusicLoudness(-22.3));

    expect(plan.music[0]?.normalizationGainDb).toBeCloseTo(6.3, 10);
    expect(plan.music[0]?.volume).toBeCloseTo(10 ** ((-12 + 6.3) / 20), 10);
  });

  it('sin medición en el asset la ganancia de normalización es 0', () => {
    const plan = timelineToSequenceProps(withMusicLoudness(undefined));

    expect(plan.music[0]?.normalizationGainDb).toBe(0);
    expect(plan.music[0]?.volume).toBeCloseTo(0.2512, 4);
  });

  it('la voz nunca se normaliza contra la referencia de música', () => {
    const plan = timelineToSequenceProps(withMusicLoudness(-30));

    expect(plan.voice[0]?.normalizationGainDb).toBe(0);
  });

  it('sin logo el plan expone logo: null', () => {
    expect(timelineToSequenceProps(timeline).logo).toBeNull();
  });

  it('con logo resuelve el src del asset y propaga la capa y el formato', () => {
    const withLogo: Timeline = {
      ...timeline,
      logo: {
        assetId: 'broll-shot-01',
        position: 'bottom-right',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    };

    const plan = timelineToSequenceProps(withLogo);

    expect(plan.logo?.assetId).toBe('broll-shot-01');
    expect(plan.logo?.src.length).toBeGreaterThan(0);
    expect(plan.logo?.overlay.position).toBe('bottom-right');
    expect(plan.logo?.format.width).toBe(1080);
  });

  it('un logo cuyo asset falta se acumula en unresolvedAssetIds y no rompe el plan', () => {
    const withMissingLogo: Timeline = {
      ...timeline,
      logo: {
        assetId: 'logo-inexistente',
        position: 'bottom-right',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    };

    const plan = timelineToSequenceProps(withMissingLogo);

    expect(plan.logo).toBeNull();
    expect(plan.unresolvedAssetIds).toContain('logo-inexistente');
  });
  it('cada bumper usa su propio logo y, sin logo propio, cae al logo del cuerpo (FIX-e-burgos-011)', () => {
    const bumper = {
      enabled: true,
      durationMs: 2000,
      backgroundColor: '#ffffff',
      animation: 'zoom' as const,
      logoWidthRatio: 0.4,
    };
    const withBumperLogo: Timeline = {
      ...timeline,
      bumpers: { intro: { ...bumper, logoAssetId: 'broll-shot-01' }, outro: bumper },
    };

    const plan = timelineToSequenceProps(withBumperLogo);

    expect(plan.bumperLogoSrc.intro?.length).toBeGreaterThan(0);
    expect(plan.bumperLogoSrc.outro).toBeNull();
    expect(plan.logo).toBeNull();
  });

  it('sin logo propio en los bumpers, ambos muestran el logo del cuerpo', () => {
    const withLogo: Timeline = {
      ...timeline,
      logo: {
        assetId: 'broll-shot-01',
        position: 'bottom-right',
        widthRatio: 0.32,
        marginRatio: 0.035,
        opacity: 1,
      },
    };

    const plan = timelineToSequenceProps(withLogo);

    expect(plan.bumperLogoSrc).toEqual({ intro: plan.logo?.src, outro: plan.logo?.src });
  });
});
