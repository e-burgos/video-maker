import type { SceneClip, Timeline } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { buildExampleTimeline } from '../__fixtures__/example-timeline';
import { sceneLoopFrames } from '../components/scene-track';
import { DEFAULT_IMAGE_KEN_BURNS } from './ken-burns';
import type { SceneAssetPlan } from './timeline-to-sequence-props';
import { timelineToSequenceProps } from './timeline-to-sequence-props';

function sceneTimeline(scenes: readonly SceneClip[]): Timeline {
  const base = buildExampleTimeline('reels-9x16');
  return {
    ...base,
    tracks: { aroll: [], broll: [], voice: [], music: [], captions: [], scenes: [...scenes] },
    transitions: [],
  };
}

function assetScene(id: string, assetId: string, patch: Partial<SceneClip> = {}): SceneClip {
  return {
    id,
    sceneId: 'scene-01',
    from: 0,
    durationFrames: 90,
    visual: {
      kind: 'asset',
      assetId,
      trimStartMs: 0,
      transform: { scale: 1, translateX: 0, translateY: 0 },
    },
    ...patch,
  };
}

describe('timelineToSequenceProps sobre la pista scenes', () => {
  it('deja la pista vacía cuando la Timeline no trae escenas', () => {
    expect(timelineToSequenceProps(buildExampleTimeline('reels-9x16')).scenes).toEqual([]);
  });

  it('resuelve el src del asset de la escena y conserva su sceneId', () => {
    const plan = timelineToSequenceProps(sceneTimeline([assetScene('clip-01', 'aroll-cam-01')]));

    expect(plan.scenes).toHaveLength(1);
    expect(plan.scenes[0]?.sceneId).toBe('scene-01');
    const visual = plan.scenes[0]?.visual as SceneAssetPlan;
    expect(visual.kind).toBe('asset');
    expect(visual.src).toContain('example/aroll.mp4');
    expect(visual.mediaKind).toBe('video');
  });

  it('le da a una imagen sin movimiento declarado el Ken Burns por defecto, y a un video ninguno', () => {
    const plan = timelineToSequenceProps(
      sceneTimeline([
        assetScene('clip-01', 'broll-shot-01'),
        { ...assetScene('clip-02', 'aroll-cam-01'), from: 90, sceneId: 'scene-02' },
      ]),
    );

    expect((plan.scenes[0]?.visual as SceneAssetPlan).kenBurns).toEqual(DEFAULT_IMAGE_KEN_BURNS);
    expect((plan.scenes[1]?.visual as SceneAssetPlan).kenBurns).toBeNull();
  });

  it('respeta el Ken Burns explícito de la escena por encima del que da por defecto', () => {
    const withMove: SceneClip = {
      id: 'clip-01',
      sceneId: 'scene-01',
      from: 0,
      durationFrames: 90,
      visual: {
        kind: 'asset',
        assetId: 'broll-shot-01',
        trimStartMs: 0,
        transform: { scale: 1, translateX: 0, translateY: 0 },
        kenBurns: { zoomFrom: 1.2, zoomTo: 1 },
      },
    };

    const plan = timelineToSequenceProps(sceneTimeline([withMove]));

    expect((plan.scenes[0]?.visual as SceneAssetPlan).kenBurns).toEqual({ zoomFrom: 1.2, zoomTo: 1 });
  });

  it('mide el asset de video en frames para poder decidir el loop', () => {
    const plan = timelineToSequenceProps(sceneTimeline([assetScene('clip-01', 'aroll-cam-01')]));

    expect((plan.scenes[0]?.visual as SceneAssetPlan).assetDurationInFrames).toBe(300);
  });

  it('degrada a placeholder y reporta el asset ausente en vez de romper el render', () => {
    const plan = timelineToSequenceProps(sceneTimeline([assetScene('clip-01', 'raw/images/ghost.png')]));

    expect(plan.scenes[0]?.visual.kind).toBe('placeholder');
    expect(plan.unresolvedAssetIds).toEqual(['raw/images/ghost.png']);
  });

  it('resuelve la imagen de una escena image-kenburns y deja src en null cuando no declara ninguna', () => {
    const plan = timelineToSequenceProps(
      sceneTimeline([
        {
          id: 'clip-01',
          sceneId: 'scene-01',
          from: 0,
          durationFrames: 90,
          visual: {
            kind: 'remotion',
            scene: { kind: 'image-kenburns', zoomFrom: 1, zoomTo: 1.2, assetId: 'broll-shot-01' },
          },
        },
        {
          id: 'clip-02',
          sceneId: 'scene-02',
          from: 90,
          durationFrames: 60,
          visual: { kind: 'remotion', scene: { kind: 'title', title: 'Hola' } },
        },
      ]),
    );

    expect(plan.scenes[0]?.visual).toMatchObject({ kind: 'remotion' });
    expect((plan.scenes[0]?.visual as { src: string | null }).src).toContain('example/broll.jpg');
    expect((plan.scenes[1]?.visual as { src: string | null }).src).toBeNull();
  });

  it('pasa el prompt de una escena placeholder tal cual', () => {
    const plan = timelineToSequenceProps(
      sceneTimeline([
        {
          id: 'clip-01',
          sceneId: 'scene-01',
          from: 0,
          durationFrames: 90,
          visual: { kind: 'placeholder', prompt: 'A kitchen at dawn' },
        },
      ]),
    );

    expect(plan.scenes[0]?.visual).toEqual({ kind: 'placeholder', prompt: 'A kitchen at dawn' });
  });
});

describe('sceneLoopFrames', () => {
  const videoPlan: SceneAssetPlan = {
    kind: 'asset',
    assetId: 'aroll-cam-01',
    src: 'file:///aroll.mp4',
    mediaKind: 'video',
    trimStartMs: 0,
    trimBefore: 0,
    assetDurationInFrames: 120,
    fit: 'cover',
    transform: { scale: 1, translateX: 0, translateY: 0 },
    kenBurns: null,
    muted: true,
  };

  it('repite el asset cuando es más corto que la escena', () => {
    expect(sceneLoopFrames(videoPlan, 300)).toBe(120);
  });

  it('no repite nada cuando el asset cubre la escena entera', () => {
    expect(sceneLoopFrames(videoPlan, 120)).toBeNull();
    expect(sceneLoopFrames(videoPlan, 60)).toBeNull();
  });

  it('descuenta el trim al medir lo que queda por reproducir', () => {
    expect(sceneLoopFrames({ ...videoPlan, trimBefore: 90 }, 300)).toBe(30);
  });

  it('no repite una imagen ni un asset sin duración medida', () => {
    expect(sceneLoopFrames({ ...videoPlan, mediaKind: 'image' }, 300)).toBeNull();
    expect(sceneLoopFrames({ ...videoPlan, assetDurationInFrames: null }, 300)).toBeNull();
  });

  it('no repite cuando el trim consume el asset entero', () => {
    expect(sceneLoopFrames({ ...videoPlan, trimBefore: 120 }, 300)).toBeNull();
  });
});
