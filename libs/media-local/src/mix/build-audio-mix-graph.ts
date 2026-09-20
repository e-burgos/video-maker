import type { AssetId, AudioClip, Fps, Timeline } from '@video-maker/timeline-core';
import { framesToMs, TimelineSchema } from '@video-maker/timeline-core';

import type { LoudnessMeasurement } from '../ffmpeg/parse-loudnorm-json';
import { UnresolvedAudioAssetError } from '../errors/unresolved-audio-asset-error';
import { buildMusicBedChain } from './build-music-bed-chain';
import { buildVoiceChain } from './build-voice-chain';
import { shiftTimelineAudioForBumpers } from './shift-timeline-audio-for-bumpers';
import type { FilterChain, FilterGraph } from './filter-graph';
import { formatFilterNumber } from './format-filter-number';

const AudioMixTimelineSchema = TimelineSchema.refine(
  (timeline) => timeline.tracks.voice.length + timeline.tracks.music.length > 0,
  { message: 'La Timeline no tiene clips de audio: no hay nada que mezclar.' },
);

export interface AudioMixGraphSpec {
  readonly timeline: Timeline;
  readonly voiceMeasuredByAssetId?: ReadonlyMap<AssetId, LoudnessMeasurement>;
}

type AudioTrack = 'voice' | 'music';

interface AudioTrackEntry {
  readonly clip: AudioClip;
  readonly track: AudioTrack;
  readonly label: string;
}

function audioStreamLabel(index: number): string {
  return `${index}:a`;
}

function collectAudioTrackEntries(timeline: Timeline): AudioTrackEntry[] {
  return [
    ...timeline.tracks.voice.map((clip, index) => ({ clip, track: 'voice' as const, label: `voice${index}` })),
    ...timeline.tracks.music.map((clip, index) => ({ clip, track: 'music' as const, label: `music${index}` })),
  ];
}

function resolveAssetPath(entry: AudioTrackEntry, timeline: Timeline): string {
  const asset = timeline.assets.find((candidate) => candidate.id === entry.clip.assetId);

  if (asset === undefined) {
    throw new UnresolvedAudioAssetError({
      assetId: entry.clip.assetId,
      clipId: entry.clip.id,
      track: entry.track,
    });
  }

  return asset.path;
}

function buildClipPrefixFilters(clip: AudioClip, fps: Fps): string[] {
  const startSeconds = clip.trimStartMs / 1000;
  const endSeconds = startSeconds + clip.durationFrames / fps;

  return [
    `atrim=start=${formatFilterNumber(startSeconds)}:end=${formatFilterNumber(endSeconds)}`,
    'asetpts=PTS-STARTPTS',
    `adelay=${formatFilterNumber(framesToMs(clip.from, fps))}:all=1`,
  ];
}

function buildClipBodyFilters(
  entry: AudioTrackEntry,
  timeline: Timeline,
  voiceMeasuredByAssetId: ReadonlyMap<AssetId, LoudnessMeasurement> | undefined,
): string[] {
  if (entry.track === 'voice') {
    return buildVoiceChain(timeline.audioMix.voice, voiceMeasuredByAssetId?.get(entry.clip.assetId));
  }

  const measuredLufs = timeline.assets.find((asset) => asset.id === entry.clip.assetId)?.audio
    ?.integratedLufs;

  return buildMusicBedChain(timeline.audioMix, {
    clip: entry.clip,
    fps: timeline.format.fps,
    videoDurationFrames: timeline.durationFrames,
    ...(measuredLufs === undefined ? {} : { measuredLufs }),
  });
}

function buildClipChain(
  entry: AudioTrackEntry,
  timeline: Timeline,
  voiceMeasuredByAssetId: ReadonlyMap<AssetId, LoudnessMeasurement> | undefined,
  inputLabel: string,
): FilterChain {
  return {
    inputLabels: [inputLabel],
    filters: [
      ...buildClipPrefixFilters(entry.clip, timeline.format.fps),
      ...buildClipBodyFilters(entry, timeline, voiceMeasuredByAssetId),
    ],
    outputLabels: [entry.label],
  };
}

function buildAmixFilters(entryCount: number, padToSeconds: string | null): string[] {
  const amix = `amix=inputs=${entryCount}:duration=longest:normalize=0`;

  // no atrim here: loudnorm offsets the voice PTS, so atrim=end would cut the tail of the mix short
  return padToSeconds === null ? [amix] : [amix, `apad=whole_dur=${padToSeconds}`];
}

export function buildAudioMixGraph(spec: AudioMixGraphSpec): FilterGraph {
  const parsed = AudioMixTimelineSchema.parse(spec.timeline);
  const timeline = shiftTimelineAudioForBumpers(parsed);
  const padToSeconds =
    timeline.durationFrames === parsed.durationFrames
      ? null
      : formatFilterNumber(timeline.durationFrames / timeline.format.fps);
  const entries = collectAudioTrackEntries(timeline);

  const inputs = entries.map((entry) => resolveAssetPath(entry, timeline));
  const chains = entries.map((entry, index) =>
    buildClipChain(entry, timeline, spec.voiceMeasuredByAssetId, audioStreamLabel(index)),
  );

  const amixChain: FilterChain = {
    inputLabels: entries.map((entry) => entry.label),
    filters: buildAmixFilters(entries.length, padToSeconds),
    outputLabels: ['mix'],
  };

  return {
    inputs,
    chains: [...chains, amixChain],
    outputLabel: 'mix',
  };
}
