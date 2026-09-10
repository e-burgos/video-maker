import { describe, expect, it } from 'vitest';

import { ca013Assets } from '../__fixtures__/assets';
import { ca013Edl } from '../__fixtures__/edl';
import { buildTimeline } from '../timeline/build-timeline';
import type { SceneClip, Timeline } from './timeline.schema';
import { SceneClipSchema, SceneVisualSchema, TimelineSchema } from './timeline.schema';

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function arollTimeline(): Timeline {
  return buildTimeline(ca013Edl, ca013Assets);
}

function sceneClip(patch: Partial<SceneClip> = {}): SceneClip {
  return {
    id: 'scene-clip-00',
    sceneId: 'scene-01',
    from: 0,
    durationFrames: 90,
    visual: { kind: 'placeholder', prompt: 'A kitchen at dawn' },
    ...patch,
  };
}

describe('SceneVisualSchema', () => {
  it('accepts an asset visual with a Ken Burns move', () => {
    const parsed = SceneVisualSchema.parse({
      kind: 'asset',
      assetId: 'raw/images/01.png',
      trimStartMs: 0,
      fit: 'cover',
      transform: { scale: 1, translateX: 0, translateY: 0 },
      kenBurns: { zoomFrom: 1, zoomTo: 1.12 },
    });

    expect(parsed.kind).toBe('asset');
  });

  it('accepts every native Remotion scene kind of the storyboard', () => {
    const visuals = [
      { kind: 'title', title: 'Hello' },
      { kind: 'text', text: 'Body copy' },
      { kind: 'code', code: 'const a = 1;', codeLanguage: 'typescript' },
      { kind: 'image-kenburns', zoomFrom: 1, zoomTo: 1.2, assetId: 'raw/images/01.png' },
    ];

    for (const scene of visuals) {
      expect(SceneVisualSchema.safeParse({ kind: 'remotion', scene }).success).toBe(true);
    }
  });

  it('rejects a Remotion scene missing the prop its kind requires', () => {
    const result = SceneVisualSchema.safeParse({ kind: 'remotion', scene: { kind: 'code', code: 'x' } });

    expect(result.success).toBe(false);
  });

  it('rejects an asset visual without a transform', () => {
    const result = SceneVisualSchema.safeParse({
      kind: 'asset',
      assetId: 'raw/images/01.png',
      trimStartMs: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown visual kind', () => {
    expect(SceneVisualSchema.safeParse({ kind: 'iframe', src: 'https://x' }).success).toBe(false);
  });
});

describe('SceneClipSchema', () => {
  it('requires a scene id and at least one frame', () => {
    expect(SceneClipSchema.safeParse(sceneClip({ durationFrames: 0 })).success).toBe(false);
    expect(SceneClipSchema.safeParse({ ...sceneClip(), sceneId: '' }).success).toBe(false);
  });
});

describe('TimelineSchema with the scenes track', () => {
  it('serializes an A-roll Timeline to the same bytes on every parse and never emits a scenes key', () => {
    const timeline = arollTimeline();
    const firstParse = TimelineSchema.parse(timeline);

    expect(serialize(TimelineSchema.parse(firstParse))).toBe(serialize(firstParse));
    expect(JSON.stringify(firstParse)).not.toContain('"scenes"');
  });

  it('keeps the scenes key out of the parsed document when the input omits it', () => {
    const parsed = TimelineSchema.parse(arollTimeline());

    expect(Object.keys(parsed.tracks)).toEqual(['aroll', 'broll', 'voice', 'music', 'captions']);
  });

  it('accepts a Timeline whose primary visual track is scenes', () => {
    const base = arollTimeline();
    const timeline = TimelineSchema.parse({
      ...base,
      durationFrames: 90,
      tracks: {
        aroll: [],
        broll: [],
        voice: [],
        music: [],
        captions: [],
        scenes: [sceneClip()],
      },
    });

    expect(timeline.tracks.scenes).toHaveLength(1);
  });

  it('rejects a scene clip that reuses the id of a clip on another track', () => {
    const base = arollTimeline();
    const firstArollId = base.tracks.aroll[0]?.id ?? '';

    const result = TimelineSchema.safeParse({
      ...base,
      tracks: { ...base.tracks, scenes: [sceneClip({ id: firstArollId })] },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('ya fue usado en tracks.aroll[0]');
  });
});
