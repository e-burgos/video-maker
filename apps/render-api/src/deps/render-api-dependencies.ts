import type { MixLoudnessVerification } from '@video-maker/media-local';
import type { MediaAsset, Timeline, VoiceTarget } from '@video-maker/timeline-core';

import type { EngineModuleStatus } from '../engine/engine-modules';
import type { BinaryStatus } from '../engine/media-binaries';
import type { ObjectStorage } from './object-storage';

export interface RenderMutedVideoInput {
  readonly timeline: Timeline;
  readonly outPath: string;
  readonly publicDir: string;
}

export interface RenderMutedVideoOutput {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export type RenderMutedVideoPort = (input: RenderMutedVideoInput) => Promise<RenderMutedVideoOutput>;

export interface MixTimelineAudioInput {
  readonly timeline: Timeline;
  readonly outPath: string;
}

export interface MixTimelineAudioOutput {
  readonly outputPath: string;
  readonly filterComplex: string;
}

export type MixTimelineAudioPort = (input: MixTimelineAudioInput) => Promise<MixTimelineAudioOutput>;

export interface MuxAudioIntoVideoInput {
  readonly videoPath: string;
  readonly audioPath: string;
  readonly outPath: string;
}

export interface MuxAudioIntoVideoOutput {
  readonly outputPath: string;
}

export type MuxAudioIntoVideoPort = (input: MuxAudioIntoVideoInput) => Promise<MuxAudioIntoVideoOutput>;

export interface VerifyMixLoudnessInput {
  readonly path: string;
  readonly target: VoiceTarget;
}

export type VerifyMixLoudnessPort = (input: VerifyMixLoudnessInput) => Promise<MixLoudnessVerification>;

export type EnsureDirectoryPort = (path: string) => Promise<void>;

export type ProbeMediaBinariesPort = () => Promise<readonly BinaryStatus[]>;

export type PreloadEngineModulesPort = () => Promise<readonly EngineModuleStatus[]>;

export interface ProbeAssetInput {
  readonly path: string;
  readonly assetId: string;
}

export type ProbeAssetPort = (input: ProbeAssetInput) => Promise<MediaAsset>;

export interface Clock {
  nowIso(): string;
}

export interface LogEvent {
  readonly event: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface Logger {
  readonly info: (event: LogEvent) => void;
  readonly error: (event: LogEvent) => void;
}

export interface RenderApiDependencies {
  readonly renderMutedVideo: RenderMutedVideoPort;
  readonly mixTimelineAudio: MixTimelineAudioPort;
  readonly muxAudioIntoVideo: MuxAudioIntoVideoPort;
  readonly verifyMixLoudness: VerifyMixLoudnessPort;
  readonly ensureDirectory: EnsureDirectoryPort;
  readonly probeMediaBinaries: ProbeMediaBinariesPort;
  readonly preloadEngineModules: PreloadEngineModulesPort;
  readonly storage: ObjectStorage;
  readonly probeAsset: ProbeAssetPort;
  readonly clock: Clock;
  readonly logger: Logger;
}
