import type { AssetId, AudioClip, MediaAsset, Timeline, VoiceTarget } from '@video-maker/timeline-core';

import { CommandFailedError } from '../errors/command-failed-error';
import { MissingMediaStreamError } from '../errors/missing-media-stream-error';
import { UnresolvedAudioAssetError } from '../errors/unresolved-audio-asset-error';
import { audioMixFfmpegArgs } from '../mix/audio-mix-ffmpeg-args';
import { buildAudioMixGraph } from '../mix/build-audio-mix-graph';
import { serializeFilterGraph } from '../mix/serialize-filter-graph';
import type { CommandOptions, CommandRunner } from '../runner/command-runner';
import { FIRST_AUDIO_STREAM, measureLoudness } from './measure-loudness';
import { withMasterBusLimiter } from './master-bus-limiter';
import type { LoudnessMeasurement } from './parse-loudnorm-json';

export interface MixTimelineAudioOptions {
  ffmpegPath?: string;
  runOptions?: CommandOptions;
}

export interface MixTimelineAudioResult {
  readonly outputPath: string;
  readonly filterComplex: string;
  readonly voiceMeasured: ReadonlyMap<AssetId, LoudnessMeasurement>;
  readonly args: readonly string[];
}

function hasAudioStream(asset: MediaAsset): boolean {
  return asset.kind === 'audio' || asset.hasAudio === true;
}

function resolveVoiceAssetPath(clip: AudioClip, timeline: Timeline): string {
  const asset = timeline.assets.find((candidate) => candidate.id === clip.assetId);

  if (asset === undefined) {
    throw new UnresolvedAudioAssetError({ assetId: clip.assetId, clipId: clip.id, track: 'voice' });
  }

  if (!hasAudioStream(asset)) {
    throw new MissingMediaStreamError({ path: asset.path, stream: 'audio', assetId: asset.id });
  }

  return asset.path;
}

function resolveVoiceMeasurementInputs(timeline: Timeline): ReadonlyMap<AssetId, string> {
  const paths = new Map<AssetId, string>();

  for (const clip of timeline.tracks.voice) {
    if (paths.has(clip.assetId)) {
      continue;
    }
    paths.set(clip.assetId, resolveVoiceAssetPath(clip, timeline));
  }

  return paths;
}

function assertMixableTimeline(timeline: Timeline): void {
  buildAudioMixGraph({ timeline });
}

async function measureVoiceAssets(
  voiceAssetPaths: ReadonlyMap<AssetId, string>,
  runner: CommandRunner,
  target: VoiceTarget,
  ffmpegPath: string,
  runOptions: CommandOptions | undefined,
): Promise<ReadonlyMap<AssetId, LoudnessMeasurement>> {
  const measured = new Map<AssetId, LoudnessMeasurement>();

  for (const [assetId, path] of voiceAssetPaths) {
    const measurement = await measureLoudness(path, runner, {
      target,
      ffmpegPath,
      audioStreamSpecifier: FIRST_AUDIO_STREAM,
      ...(runOptions !== undefined ? { runOptions } : {}),
    });
    measured.set(assetId, measurement);
  }

  return measured;
}

export async function mixTimelineAudio(
  timeline: Timeline,
  out: string,
  runner: CommandRunner,
  opts?: MixTimelineAudioOptions,
): Promise<MixTimelineAudioResult> {
  const ffmpegPath = opts?.ffmpegPath ?? 'ffmpeg';

  const voiceAssetPaths = resolveVoiceMeasurementInputs(timeline);
  assertMixableTimeline(timeline);
  const voiceMeasured = await measureVoiceAssets(
    voiceAssetPaths,
    runner,
    timeline.audioMix.voice,
    ffmpegPath,
    opts?.runOptions,
  );

  const mixGraph = buildAudioMixGraph({ timeline, voiceMeasuredByAssetId: voiceMeasured });
  const graph = withMasterBusLimiter(mixGraph, timeline.audioMix.voice);
  const args = audioMixFfmpegArgs(graph, out);

  const result = await runner.run(ffmpegPath, args, opts?.runOptions);
  if (result.exitCode !== 0) {
    throw new CommandFailedError({
      command: ffmpegPath,
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  return {
    outputPath: out,
    filterComplex: serializeFilterGraph(graph),
    voiceMeasured,
    args,
  };
}
