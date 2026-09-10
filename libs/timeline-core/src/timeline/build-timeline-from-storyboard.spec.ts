import { describe, expect, it } from 'vitest';

import {
  sceneAssemblyAssets,
  sceneAssemblyAssignment,
  sceneAssemblyStoryboard,
  sceneAssemblyVoice,
} from '../__fixtures__/scene-assembly';
import { defaultFormat } from '../format/format';
import type { StoryboardDocument } from '../schemas/storyboard.schema';
import type { VoiceManifest } from '../schemas/voice-manifest.schema';
import {
  DEFAULT_SCENE_PADDING_MS,
  StoryboardTimelineError,
  buildTimelineFromStoryboard,
} from './build-timeline-from-storyboard';
import type { BuildTimelineFromStoryboardInput, SceneWords } from './build-timeline-from-storyboard';
import { validateTimeline } from './validate-timeline';

const FORMAT = defaultFormat('reels-9x16');

function baseInput(patch: Partial<BuildTimelineFromStoryboardInput> = {}): BuildTimelineFromStoryboardInput {
  return {
    storyboard: sceneAssemblyStoryboard,
    format: FORMAT,
    assets: sceneAssemblyAssets,
    voice: sceneAssemblyVoice,
    assignment: sceneAssemblyAssignment,
    ...patch,
  };
}

const sceneOneWords: readonly SceneWords[] = [
  {
    sceneId: 'scene-01',
    words: [
      { text: 'Primero', startMs: 0, endMs: 600 },
      { text: 'elegís', startMs: 620, endMs: 1200 },
      { text: 'el', startMs: 1220, endMs: 1400 },
      { text: 'plano', startMs: 1420, endMs: 2400 },
    ],
  },
];

describe('buildTimelineFromStoryboard', () => {
  it('toma la duración de cada escena de su voz real, no de la estimada', () => {
    const { placements } = buildTimelineFromStoryboard(baseInput());

    expect(placements[0]).toMatchObject({ sceneId: 'scene-01', durationSource: 'voice' });
    expect(placements[0]?.durationFrames).toBe(Math.round(((3000 + DEFAULT_SCENE_PADDING_MS) / 1000) * 30));
    expect(placements[1]?.durationFrames).toBe(Math.round(((5886 + DEFAULT_SCENE_PADDING_MS) / 1000) * 30));
  });

  it('demuestra la diferencia: la estimada de esas escenas es 9000 ms y no se usa en ninguna', () => {
    const { placements } = buildTimelineFromStoryboard(baseInput());
    const estimatedFrames = Math.round((9000 / 1000) * 30);

    expect(placements[0]?.durationFrames).not.toBe(estimatedFrames);
    expect(placements[1]?.durationFrames).not.toBe(estimatedFrames);
  });

  it('cae en la duración estimada sólo para la escena que no tiene voz, y la reporta', () => {
    const result = buildTimelineFromStoryboard(baseInput());

    expect(result.placements[2]).toMatchObject({ sceneId: 'scene-03', durationSource: 'estimate' });
    expect(result.placements[2]?.durationFrames).toBe(Math.round((2000 / 1000) * 30));
    expect(result.scenesWithoutVoice).toEqual(['scene-03']);
  });

  it('respeta un padding configurado en vez del de fábrica', () => {
    const { placements } = buildTimelineFromStoryboard(baseInput({ scenePaddingMs: 0 }));

    expect(placements[0]?.durationFrames).toBe(90);
  });

  it('coloca las escenas contiguas y hace que durationFrames sea su suma', () => {
    const { timeline, placements } = buildTimelineFromStoryboard(baseInput());
    const scenes = timeline.tracks.scenes ?? [];

    expect(scenes.map((clip) => clip.from)).toEqual([0, placements[0]?.durationFrames, 
      (placements[0]?.durationFrames ?? 0) + (placements[1]?.durationFrames ?? 0)]);
    expect(timeline.durationFrames).toBe(
      placements.reduce((total, placement) => total + placement.durationFrames, 0),
    );
  });

  it('produce una Timeline que pasa validateTimeline', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput({ words: sceneOneWords }));

    expect(validateTimeline(timeline)).toEqual({ ok: true });
  });

  it('deja la pista aroll vacía para no competir con la pista visual primaria', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput());

    expect(timeline.tracks.aroll).toEqual([]);
    expect(timeline.tracks.broll).toEqual([]);
  });

  it('resuelve cada visualSource en el visual que le corresponde', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput());
    const scenes = timeline.tracks.scenes ?? [];

    expect(scenes[0]?.visual).toMatchObject({ kind: 'asset', assetId: 'raw/images/01.png' });
    expect(scenes[1]?.visual).toMatchObject({ kind: 'remotion', scene: { kind: 'title' } });
    expect(scenes[2]?.visual).toMatchObject({ kind: 'asset', assetId: 'raw/broll/02.mp4' });
  });

  it('cae en un placeholder con el prompt visible cuando una escena upload no tiene asset asignado', () => {
    const result = buildTimelineFromStoryboard(baseInput({ assignment: undefined }));
    const scenes = result.timeline.tracks.scenes ?? [];

    expect(scenes[0]?.visual).toEqual({
      kind: 'placeholder',
      prompt: 'A kitchen at dawn, vertical framing.',
    });
    expect(result.scenesWithoutVisual).toEqual(['scene-01']);
    expect(validateTimeline(result.timeline)).toEqual({ ok: true });
  });

  it('arma la pista de voz desde el manifest, una entrada por escena con voz', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput());

    expect(timeline.tracks.voice).toHaveLength(2);
    expect(timeline.tracks.voice[0]).toMatchObject({
      assetId: 'work/voice/scene-01.wav',
      from: 0,
      trimStartMs: 0,
      gainDb: 0,
    });
    expect(timeline.tracks.voice[1]?.from).toBe(timeline.tracks.scenes?.[1]?.from);
  });

  it('nunca deja la voz más larga que su escena, aun con padding cero', () => {
    const { timeline, placements } = buildTimelineFromStoryboard(baseInput({ scenePaddingMs: 0 }));

    timeline.tracks.voice.forEach((clip, index) => {
      expect(clip.durationFrames).toBeLessThanOrEqual(placements[index]?.durationFrames ?? 0);
    });
  });

  it('nunca reclama más frames del wav de los que el wav tiene, con una duración que no cae en frame exacto', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput());
    const sceneTwoVoice = timeline.tracks.voice[1];

    expect(sceneTwoVoice?.assetId).toBe('work/voice/scene-02.wav');
    expect(sceneTwoVoice?.durationFrames).toBe(Math.floor((5886 / 1000) * 30));
    expect(validateTimeline(timeline)).toEqual({ ok: true });
  });

  it('demuestra el fallo que evita: redondear esa duración hacia arriba rompe validateTimeline', () => {
    const { timeline } = buildTimelineFromStoryboard(baseInput());
    const roundedUp: typeof timeline = {
      ...timeline,
      tracks: {
        ...timeline.tracks,
        voice: timeline.tracks.voice.map((clip, index) =>
          index === 1 ? { ...clip, durationFrames: Math.round((5886 / 1000) * 30) } : clip,
        ),
      },
    };

    const result = validateTimeline(roundedUp);

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues.map((issue) => issue.code)).toContain('CLIP_EXCEEDS_ASSET');
  });

  it('arma las captions desde los words de la escena y las desplaza a su inicio', () => {
    const words: readonly SceneWords[] = [
      ...sceneOneWords,
      {
        sceneId: 'scene-02',
        words: [
          { text: 'Después', startMs: 0, endMs: 700 },
          { text: 'el', startMs: 720, endMs: 900 },
          { text: 'título', startMs: 920, endMs: 1800 },
        ],
      },
    ];

    const { timeline, placements } = buildTimelineFromStoryboard(baseInput({ words }));
    const sceneTwoStart = placements[1]?.from ?? 0;
    const sceneTwoCaptions = timeline.tracks.captions.filter((clip) => clip.from >= sceneTwoStart);

    expect(timeline.tracks.captions.length).toBeGreaterThan(1);
    expect(timeline.tracks.captions[0]?.from).toBe(0);
    expect(sceneTwoCaptions[0]?.from).toBe(sceneTwoStart);
    expect(sceneTwoCaptions[0]?.words[0]?.fromFrame).toBe(0);
  });

  it('recorta la caption que se pasaría del final de su escena', () => {
    const words: readonly SceneWords[] = [
      { sceneId: 'scene-03', words: [{ text: 'Cierre', startMs: 1800, endMs: 5000 }] },
    ];

    const { timeline, placements } = buildTimelineFromStoryboard(baseInput({ words }));
    const sceneThree = placements[2];
    const lastCaption = timeline.tracks.captions[timeline.tracks.captions.length - 1];

    expect(lastCaption).toBeDefined();
    expect((lastCaption?.from ?? 0) + (lastCaption?.durationFrames ?? 0)).toBeLessThanOrEqual(
      (sceneThree?.from ?? 0) + (sceneThree?.durationFrames ?? 0),
    );
  });

  it('sin música no escribe automatización de ducking; con música sí', () => {
    const withoutMusic = buildTimelineFromStoryboard(baseInput());
    const withMusic = buildTimelineFromStoryboard(baseInput({ music: { assetId: 'raw/audio/music01.mp3' } }));

    expect(withoutMusic.timeline.tracks.music).toEqual([]);
    expect(withoutMusic.timeline.audioMix.automation).toEqual([]);
    expect(withMusic.timeline.tracks.music).toHaveLength(1);
    expect(withMusic.timeline.tracks.music[0]?.durationFrames).toBe(withMusic.timeline.durationFrames);
    expect(withMusic.timeline.audioMix.automation.length).toBeGreaterThan(0);
  });

  it('es determinista: dos corridas con la misma entrada dan los mismos bytes', () => {
    const first = buildTimelineFromStoryboard(baseInput({ words: sceneOneWords }));
    const second = buildTimelineFromStoryboard(baseInput({ words: sceneOneWords }));

    expect(JSON.stringify(first.timeline)).toBe(JSON.stringify(second.timeline));
  });

  it('rechaza un storyboard sin escenas', () => {
    const empty: StoryboardDocument = { ...sceneAssemblyStoryboard, scenes: [] };

    expect(() => buildTimelineFromStoryboard(baseInput({ storyboard: empty }))).toThrowError(
      StoryboardTimelineError,
    );
  });

  it('rechaza una escena sin voz cuya duración estimada es cero', () => {
    const storyboard: StoryboardDocument = {
      ...sceneAssemblyStoryboard,
      scenes: sceneAssemblyStoryboard.scenes.map((scene) =>
        scene.id === 'scene-03' ? { ...scene, estimatedDurationMs: 0 } : scene,
      ),
    };

    try {
      buildTimelineFromStoryboard(baseInput({ storyboard }));
      expect.unreachable('debía rechazar la escena sin duración');
    } catch (cause) {
      expect(cause).toBeInstanceOf(StoryboardTimelineError);
      expect((cause as StoryboardTimelineError).code).toBe('SCENE_WITHOUT_DURATION');
      expect((cause as StoryboardTimelineError).resource).toBe('scene-03');
    }
  });

  it('rechaza una asignación que apunta a un asset que no está en el catálogo', () => {
    const assignment = {
      schemaVersion: 1 as const,
      storyboardId: 'storyboard-assembly',
      assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/ghost.png' }],
    };

    try {
      buildTimelineFromStoryboard(baseInput({ assignment }));
      expect.unreachable('debía rechazar el asset ausente');
    } catch (cause) {
      expect((cause as StoryboardTimelineError).code).toBe('ASSET_NOT_IN_CATALOG');
      expect((cause as StoryboardTimelineError).resource).toBe('raw/images/ghost.png');
    }
  });

  it('rechaza un manifest cuya pista de voz no está en el catálogo de assets', () => {
    const voice: VoiceManifest = {
      ...sceneAssemblyVoice,
      tracks: sceneAssemblyVoice.tracks.map((track) =>
        track.sceneId === 'scene-01' ? { ...track, path: 'work/voice/ghost.wav' } : track,
      ),
    };

    try {
      buildTimelineFromStoryboard(baseInput({ voice }));
      expect.unreachable('debía rechazar la voz ausente');
    } catch (cause) {
      expect((cause as StoryboardTimelineError).code).toBe('ASSET_NOT_IN_CATALOG');
    }
  });

  it('rechaza una escena image-kenburns cuya imagen no está en el catálogo', () => {
    const storyboard: StoryboardDocument = {
      ...sceneAssemblyStoryboard,
      scenes: sceneAssemblyStoryboard.scenes.map((scene) =>
        scene.id === 'scene-02'
          ? {
              ...scene,
              remotionScene: { kind: 'image-kenburns', zoomFrom: 1, zoomTo: 1.2, assetId: 'raw/images/ghost.png' },
            }
          : scene,
      ),
    };

    expect(() => buildTimelineFromStoryboard(baseInput({ storyboard }))).toThrowError(StoryboardTimelineError);
  });
});
