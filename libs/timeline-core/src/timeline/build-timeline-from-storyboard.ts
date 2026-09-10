import { groupWordsForCaptions } from '../captions/group-words-for-captions';
import type { TranscriptWord } from '../captions/group-words-for-captions';
import { DEFAULT_AUDIO_MIX_PLAN, DEFAULT_MUSIC_MIX, planDucking } from '../ducking/plan-ducking';
import type { VoiceRange } from '../ducking/plan-ducking';
import { safeZoneFor } from '../format/format';
import type { MediaAsset } from '../schemas/media-asset.schema';
import type { OutputFormat } from '../schemas/output-format.schema';
import type { SceneAssignment } from '../schemas/scene-assignment.schema';
import { findSceneAssignment } from '../schemas/scene-assignment.schema';
import type { StoryboardDocument, StoryboardScene } from '../schemas/storyboard.schema';
import type {
  AudioClip,
  CaptionClip,
  CaptionClipBox,
  SceneClip,
  SceneVisual,
  Timeline,
} from '../schemas/timeline.schema';
import type { VoiceManifest, VoiceTrack } from '../schemas/voice-manifest.schema';
import type { AssetId, Db, Fps, Frame, Ms } from '../types/units';
import { framesToMs, msToFrames } from '../units/units';
import type { MusicInput } from './build-timeline';
import { sequentialId } from './ids';

export const DEFAULT_SCENE_PADDING_MS: Ms = 250;

export type StoryboardTimelineErrorCode =
  | 'EMPTY_STORYBOARD'
  | 'SCENE_WITHOUT_DURATION'
  | 'ASSET_NOT_IN_CATALOG';

export class StoryboardTimelineError extends Error {
  readonly code: StoryboardTimelineErrorCode;
  readonly resource: string;

  constructor(code: StoryboardTimelineErrorCode, resource: string, message: string) {
    super(message);
    this.name = 'StoryboardTimelineError';
    this.code = code;
    this.resource = resource;
  }
}

export interface SceneWords {
  readonly sceneId: string;
  readonly words: readonly TranscriptWord[];
}

export interface BuildTimelineFromStoryboardInput {
  readonly storyboard: StoryboardDocument;
  readonly format: OutputFormat;
  readonly assets: readonly MediaAsset[];
  readonly voice?: VoiceManifest | undefined;
  readonly words?: readonly SceneWords[] | undefined;
  readonly assignment?: SceneAssignment | undefined;
  readonly music?: MusicInput | undefined;
  readonly scenePaddingMs?: Ms | undefined;
}

export interface ScenePlacement {
  readonly sceneId: string;
  readonly index: number;
  readonly from: Frame;
  readonly durationFrames: Frame;
  readonly durationSource: 'voice' | 'estimate';
}

export interface BuildTimelineFromStoryboardResult {
  readonly timeline: Timeline;
  readonly placements: readonly ScenePlacement[];
  readonly scenesWithoutVoice: readonly string[];
  readonly scenesWithoutVisual: readonly string[];
}

function optionalField<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? ({} as { [P in K]?: V }) : ({ [key]: value } as { [P in K]?: V });
}

function findAsset(assets: readonly MediaAsset[], assetId: AssetId): MediaAsset | undefined {
  return assets.find((asset) => asset.id === assetId);
}

function requireAsset(assets: readonly MediaAsset[], assetId: AssetId, sceneId: string): MediaAsset {
  const asset = findAsset(assets, assetId);
  if (asset === undefined) {
    throw new StoryboardTimelineError(
      'ASSET_NOT_IN_CATALOG',
      assetId,
      `La escena "${sceneId}" referencia el asset "${assetId}", que no está en el catálogo.`,
    );
  }
  return asset;
}

function voiceTrackOf(voice: VoiceManifest | undefined, sceneId: string): VoiceTrack | undefined {
  return voice?.tracks.find((track) => track.sceneId === sceneId);
}

function sceneDurationMs(scene: StoryboardScene, track: VoiceTrack | undefined, paddingMs: Ms): Ms {
  return track === undefined ? scene.estimatedDurationMs : track.durationMs + paddingMs;
}

function resolveAssignedAssetId(
  scene: StoryboardScene,
  assignment: SceneAssignment | undefined,
): AssetId | undefined {
  if (scene.visualSource === 'asset') {
    return scene.assetId;
  }
  if (scene.visualSource === 'upload' && assignment !== undefined) {
    return findSceneAssignment(assignment, scene.id)?.assetId;
  }
  return undefined;
}

function assetVisual(asset: MediaAsset): SceneVisual {
  return {
    kind: 'asset',
    assetId: asset.id,
    trimStartMs: 0,
    fit: 'cover',
    transform: { scale: 1, translateX: 0, translateY: 0 },
    muted: true,
  };
}

function sceneVisualOf(
  scene: StoryboardScene,
  assets: readonly MediaAsset[],
  assignment: SceneAssignment | undefined,
): SceneVisual {
  if (scene.visualSource === 'remotion-scene' && scene.remotionScene !== undefined) {
    if (scene.remotionScene.assetId !== undefined) {
      requireAsset(assets, scene.remotionScene.assetId, scene.id);
    }
    return { kind: 'remotion', scene: scene.remotionScene };
  }

  const assetId = resolveAssignedAssetId(scene, assignment);
  if (assetId === undefined) {
    return { kind: 'placeholder', prompt: scene.visualPrompt };
  }

  return assetVisual(requireAsset(assets, assetId, scene.id));
}

function wordsOf(words: readonly SceneWords[] | undefined, sceneId: string): readonly TranscriptWord[] {
  return words?.find((entry) => entry.sceneId === sceneId)?.words ?? [];
}

function safeZoneBox(format: OutputFormat): CaptionClipBox {
  const safeZone = safeZoneFor(format);
  return {
    x: safeZone.left,
    y: safeZone.top,
    width: format.width - safeZone.left - safeZone.right,
    height: format.height - safeZone.top - safeZone.bottom,
  };
}

function buildCaptionClips(
  placements: readonly ScenePlacement[],
  words: readonly SceneWords[] | undefined,
  format: OutputFormat,
  fps: Fps,
): CaptionClip[] {
  const box = safeZoneBox(format);
  const clips: CaptionClip[] = [];

  for (const placement of placements) {
    const sceneWords = wordsOf(words, placement.sceneId);
    const sceneEndFrame = placement.from + placement.durationFrames;

    for (const group of groupWordsForCaptions(sceneWords)) {
      const from = placement.from + msToFrames(group.startMs, fps);
      if (from >= sceneEndFrame) {
        continue;
      }

      const rawEndFrame = placement.from + msToFrames(group.endMs, fps);
      clips.push({
        id: sequentialId('caption', clips.length),
        from,
        durationFrames: Math.max(1, Math.min(rawEndFrame, sceneEndFrame) - from),
        words: group.words.map((word) => ({
          text: word.text,
          fromFrame: Math.max(0, msToFrames(word.startMs - group.startMs, fps)),
          durationFrames: Math.max(1, msToFrames(word.endMs - word.startMs, fps)),
        })),
        emphasisIndex: group.emphasisIndex,
        box,
      });
    }
  }

  return clips;
}

function buildVoiceClips(
  placements: readonly ScenePlacement[],
  voice: VoiceManifest | undefined,
  assets: readonly MediaAsset[],
  fps: Fps,
): AudioClip[] {
  const clips: AudioClip[] = [];

  for (const placement of placements) {
    const track = voiceTrackOf(voice, placement.sceneId);
    if (track === undefined) {
      continue;
    }

    const asset = requireAsset(assets, track.path, placement.sceneId);
    clips.push({
      id: sequentialId('voice', clips.length),
      assetId: asset.id,
      from: placement.from,
      durationFrames: Math.max(
        1,
        Math.min(msToFrames(track.durationMs, fps, 'floor'), placement.durationFrames),
      ),
      trimStartMs: 0,
      gainDb: 0,
    });
  }

  return clips;
}

function voiceRangesOf(clips: readonly AudioClip[], fps: Fps): VoiceRange[] {
  return clips.map((clip) => ({
    startMs: framesToMs(clip.from, fps),
    endMs: framesToMs(clip.from + clip.durationFrames, fps),
  }));
}

function buildMusicClip(music: MusicInput, baseGainDb: Db, durationFrames: Frame): AudioClip {
  return {
    id: sequentialId('music', 0),
    assetId: music.assetId,
    from: 0,
    durationFrames,
    trimStartMs: music.trimStartMs ?? 0,
    gainDb: music.gainDb ?? baseGainDb,
    ...optionalField('fadeInFrames', music.fadeInFrames),
    ...optionalField('fadeOutFrames', music.fadeOutFrames),
  };
}

function planScenes(
  storyboard: StoryboardDocument,
  voice: VoiceManifest | undefined,
  paddingMs: Ms,
  fps: Fps,
): ScenePlacement[] {
  const placements: ScenePlacement[] = [];
  let cursorFrame = 0;

  for (const scene of storyboard.scenes) {
    const track = voiceTrackOf(voice, scene.id);
    const durationMs = sceneDurationMs(scene, track, paddingMs);

    if (durationMs <= 0) {
      throw new StoryboardTimelineError(
        'SCENE_WITHOUT_DURATION',
        scene.id,
        `La escena "${scene.id}" no tiene voz ni una duración estimada mayor a cero.`,
      );
    }

    const durationFrames = Math.max(1, msToFrames(durationMs, fps));

    placements.push({
      sceneId: scene.id,
      index: scene.index,
      from: cursorFrame,
      durationFrames,
      durationSource: track === undefined ? 'estimate' : 'voice',
    });
    cursorFrame += durationFrames;
  }

  return placements;
}

export function buildTimelineFromStoryboard(
  input: BuildTimelineFromStoryboardInput,
): BuildTimelineFromStoryboardResult {
  const { storyboard, format, assets, voice, words, assignment, music } = input;
  const fps = format.fps;
  const paddingMs = input.scenePaddingMs ?? DEFAULT_SCENE_PADDING_MS;

  if (storyboard.scenes.length === 0) {
    throw new StoryboardTimelineError('EMPTY_STORYBOARD', storyboard.id, 'El storyboard no tiene escenas.');
  }

  const placements = planScenes(storyboard, voice, paddingMs, fps);
  const durationFrames = placements.reduce(
    (total, placement) => total + placement.durationFrames,
    0,
  );

  const sceneClips: SceneClip[] = storyboard.scenes.map((scene, position) => {
    const placement = placements[position];
    return {
      id: sequentialId('scene', position),
      sceneId: scene.id,
      from: placement?.from ?? 0,
      durationFrames: placement?.durationFrames ?? 1,
      visual: sceneVisualOf(scene, assets, assignment),
    };
  });

  const voiceClips = buildVoiceClips(placements, voice, assets, fps);
  const captionClips = buildCaptionClips(placements, words, format, fps);

  const automation =
    music === undefined ? [] : planDucking(voiceRangesOf(voiceClips, fps), DEFAULT_MUSIC_MIX, fps).automation;
  const audioMix = {
    voice: { ...DEFAULT_AUDIO_MIX_PLAN.voice },
    music: { ...DEFAULT_AUDIO_MIX_PLAN.music },
    automation,
  };
  const musicClips = music === undefined ? [] : [buildMusicClip(music, audioMix.music.baseGainDb, durationFrames)];

  const timeline: Timeline = {
    schemaVersion: 1,
    id: `timeline-${storyboard.id}`,
    format,
    durationFrames,
    assets: [...assets],
    tracks: {
      aroll: [],
      broll: [],
      voice: voiceClips,
      music: musicClips,
      captions: captionClips,
      scenes: sceneClips,
    },
    transitions: [],
    audioMix,
    safeZone: safeZoneFor(format),
  };

  return {
    timeline,
    placements,
    scenesWithoutVoice: placements
      .filter((placement) => placement.durationSource === 'estimate')
      .map((placement) => placement.sceneId),
    scenesWithoutVisual: sceneClips
      .filter((clip) => clip.visual.kind === 'placeholder')
      .map((clip) => clip.sceneId),
  };
}
