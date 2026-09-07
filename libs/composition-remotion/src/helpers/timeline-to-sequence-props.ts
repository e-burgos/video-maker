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
  Timeline,
  TimelineTransition,
  VideoClip,
} from '@video-maker/timeline-core';
import { msToFrames } from '@video-maker/timeline-core';
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
    voice,
    music,
    captions,
    unresolvedAssetIds: [...unresolvedAssetIds],
  };
}
