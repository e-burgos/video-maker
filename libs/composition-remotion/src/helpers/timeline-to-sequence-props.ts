import type {
  AssetId,
  AudioClip,
  CaptionClip,
  ClipId,
  Db,
  Fps,
  Frame,
  MediaAsset,
  Ms,
  RemotionScene,
  SceneClip,
  SceneKenBurns,
  Timeline,
  TimelineTransition,
  VideoClip,
} from '@video-maker/timeline-core';
import { msToFrames } from '@video-maker/timeline-core';
import { DEFAULT_IMAGE_KEN_BURNS } from './ken-burns';
import { assetSrc } from './asset-src';
import { gainDbToVolume } from './audio-gain';
import type {
  CaptionBox,
  CaptionWord,
  ClipFit,
  ClipTransform,
  TimelineTiming,
  TransitionDirection,
  TransitionKind,
} from './timeline-types';

export interface VideoSequenceProps {
  clipId: ClipId;
  assetId: AssetId;
  src: string;
  kind: MediaAsset['kind'];
  from: Frame;
  durationInFrames: number;
  trimStartMs: Ms;
  trimBefore: Frame;
  transform: ClipTransform;
  fit: ClipFit;
  muted: boolean;
}

export interface AudioSequenceProps {
  clipId: ClipId;
  assetId: AssetId;
  src: string;
  from: Frame;
  durationInFrames: number;
  trimStartMs: Ms;
  trimBefore: Frame;
  gainDb: Db;
  volume: number;
  fadeInFrames: Frame | null;
  fadeOutFrames: Frame | null;
}

export interface CaptionSequenceProps {
  clipId: ClipId;
  from: Frame;
  durationInFrames: number;
  words: readonly CaptionWord[];
  emphasisIndex: number | null;
  box: CaptionBox | null;
}

export interface SceneAssetPlan {
  kind: 'asset';
  assetId: AssetId;
  src: string;
  mediaKind: MediaAsset['kind'];
  trimStartMs: Ms;
  trimBefore: Frame;
  assetDurationInFrames: number | null;
  fit: ClipFit;
  transform: ClipTransform;
  kenBurns: SceneKenBurns | null;
  muted: boolean;
}

export interface SceneRemotionPlan {
  kind: 'remotion';
  scene: RemotionScene;
  src: string | null;
}

export interface ScenePlaceholderPlan {
  kind: 'placeholder';
  prompt: string;
}

export type SceneVisualPlan = SceneAssetPlan | SceneRemotionPlan | ScenePlaceholderPlan;

export interface SceneSequenceProps {
  clipId: ClipId;
  sceneId: string;
  from: Frame;
  durationInFrames: number;
  visual: SceneVisualPlan;
}

export interface ArollTransitionPlan {
  betweenClipIds: readonly [ClipId, ClipId];
  kind: TransitionKind;
  direction: TransitionDirection | null;
  durationInFrames: number;
  timing: TimelineTiming;
}

export interface SequencePropsPlan {
  fps: Fps;
  width: number;
  height: number;
  durationInFrames: number;
  aroll: readonly VideoSequenceProps[];
  arollTransitions: readonly ArollTransitionPlan[];
  broll: readonly VideoSequenceProps[];
  scenes: readonly SceneSequenceProps[];
  voice: readonly AudioSequenceProps[];
  music: readonly AudioSequenceProps[];
  captions: readonly CaptionSequenceProps[];
  unresolvedAssetIds: readonly AssetId[];
}

function resolveAsset(assets: readonly MediaAsset[], assetId: AssetId): MediaAsset | undefined {
  return assets.find((asset) => asset.id === assetId);
}

function toVideoSequenceProps(clip: VideoClip, asset: MediaAsset, fps: Fps): VideoSequenceProps {
  return {
    clipId: clip.id,
    assetId: clip.assetId,
    src: assetSrc(asset),
    kind: asset.kind,
    from: clip.from,
    durationInFrames: clip.durationFrames,
    trimStartMs: clip.trimStartMs,
    trimBefore: msToFrames(clip.trimStartMs, fps),
    transform: clip.transform,
    fit: clip.fit ?? 'cover',
    muted: clip.muted ?? false,
  };
}

function toAudioSequenceProps(clip: AudioClip, asset: MediaAsset, fps: Fps): AudioSequenceProps {
  return {
    clipId: clip.id,
    assetId: clip.assetId,
    src: assetSrc(asset),
    from: clip.from,
    durationInFrames: clip.durationFrames,
    trimStartMs: clip.trimStartMs,
    trimBefore: msToFrames(clip.trimStartMs, fps),
    gainDb: clip.gainDb,
    volume: gainDbToVolume(clip.gainDb),
    fadeInFrames: clip.fadeInFrames ?? null,
    fadeOutFrames: clip.fadeOutFrames ?? null,
  };
}

function toCaptionSequenceProps(clip: CaptionClip): CaptionSequenceProps {
  return {
    clipId: clip.id,
    from: clip.from,
    durationInFrames: clip.durationFrames,
    words: clip.words,
    emphasisIndex: clip.emphasisIndex ?? null,
    box: clip.box ?? null,
  };
}

function mapVideoTrack(
  clips: readonly VideoClip[],
  assets: readonly MediaAsset[],
  fps: Fps,
  unresolvedAssetIds: Set<AssetId>,
): VideoSequenceProps[] {
  const mapped: VideoSequenceProps[] = [];

  for (const clip of clips) {
    const asset = resolveAsset(assets, clip.assetId);
    if (asset === undefined) {
      unresolvedAssetIds.add(clip.assetId);
      continue;
    }
    mapped.push(toVideoSequenceProps(clip, asset, fps));
  }

  return mapped;
}

function mapAudioTrack(
  clips: readonly AudioClip[],
  assets: readonly MediaAsset[],
  fps: Fps,
  unresolvedAssetIds: Set<AssetId>,
): AudioSequenceProps[] {
  const mapped: AudioSequenceProps[] = [];

  for (const clip of clips) {
    const asset = resolveAsset(assets, clip.assetId);
    if (asset === undefined) {
      unresolvedAssetIds.add(clip.assetId);
      continue;
    }
    mapped.push(toAudioSequenceProps(clip, asset, fps));
  }

  return mapped;
}

function assetDurationInFrames(asset: MediaAsset, fps: Fps): number | null {
  return asset.kind === 'video' ? Math.max(1, msToFrames(asset.durationMs, fps, 'floor')) : null;
}

function toSceneVisualPlan(
  clip: SceneClip,
  assets: readonly MediaAsset[],
  fps: Fps,
  unresolvedAssetIds: Set<AssetId>,
): SceneVisualPlan {
  if (clip.visual.kind === 'placeholder') {
    return { kind: 'placeholder', prompt: clip.visual.prompt };
  }

  if (clip.visual.kind === 'remotion') {
    const { scene } = clip.visual;
    if (scene.assetId === undefined) {
      return { kind: 'remotion', scene, src: null };
    }
    const asset = resolveAsset(assets, scene.assetId);
    if (asset === undefined) {
      unresolvedAssetIds.add(scene.assetId);
      return { kind: 'remotion', scene, src: null };
    }
    return { kind: 'remotion', scene, src: assetSrc(asset) };
  }

  const visual = clip.visual;
  const asset = resolveAsset(assets, visual.assetId);
  if (asset === undefined) {
    unresolvedAssetIds.add(visual.assetId);
    return { kind: 'placeholder', prompt: visual.assetId };
  }

  const kenBurns = visual.kenBurns ?? (asset.kind === 'image' ? DEFAULT_IMAGE_KEN_BURNS : null);

  return {
    kind: 'asset',
    assetId: visual.assetId,
    src: assetSrc(asset),
    mediaKind: asset.kind,
    trimStartMs: visual.trimStartMs,
    trimBefore: msToFrames(visual.trimStartMs, fps),
    assetDurationInFrames: assetDurationInFrames(asset, fps),
    fit: visual.fit ?? 'cover',
    transform: visual.transform,
    kenBurns,
    muted: visual.muted ?? true,
  };
}

function mapSceneTrack(
  clips: readonly SceneClip[],
  assets: readonly MediaAsset[],
  fps: Fps,
  unresolvedAssetIds: Set<AssetId>,
): SceneSequenceProps[] {
  return clips.map((clip) => ({
    clipId: clip.id,
    sceneId: clip.sceneId,
    from: clip.from,
    durationInFrames: clip.durationFrames,
    visual: toSceneVisualPlan(clip, assets, fps, unresolvedAssetIds),
  }));
}

function mapArollTransitions(transitions: readonly TimelineTransition[]): ArollTransitionPlan[] {
  const plans: ArollTransitionPlan[] = [];

  for (const transition of transitions) {
    const [outgoingClipId, enteringClipId] = transition.betweenClipIds;
    if (outgoingClipId === undefined || enteringClipId === undefined) {
      continue;
    }

    plans.push({
      betweenClipIds: [outgoingClipId, enteringClipId],
      kind: transition.kind,
      direction: transition.direction ?? null,
      durationInFrames: transition.durationFrames,
      timing: transition.timing,
    });
  }

  return plans;
}

export function timelineToSequenceProps(timeline: Timeline): SequencePropsPlan {
  const { fps } = timeline.format;
  const unresolvedAssetIds = new Set<AssetId>();

  const aroll = mapVideoTrack(timeline.tracks.aroll, timeline.assets, fps, unresolvedAssetIds);
  const broll = mapVideoTrack(timeline.tracks.broll, timeline.assets, fps, unresolvedAssetIds);
  const scenes = mapSceneTrack(timeline.tracks.scenes ?? [], timeline.assets, fps, unresolvedAssetIds);
  const voice = mapAudioTrack(timeline.tracks.voice, timeline.assets, fps, unresolvedAssetIds);
  const music = mapAudioTrack(timeline.tracks.music, timeline.assets, fps, unresolvedAssetIds);
  const captions = timeline.tracks.captions.map(toCaptionSequenceProps);
  const arollTransitions = mapArollTransitions(timeline.transitions ?? []);

  return {
    fps,
    width: timeline.format.width,
    height: timeline.format.height,
    durationInFrames: timeline.durationFrames,
    aroll,
    arollTransitions,
    broll,
    scenes,
    voice,
    music,
    captions,
    unresolvedAssetIds: [...unresolvedAssetIds],
  };
}
