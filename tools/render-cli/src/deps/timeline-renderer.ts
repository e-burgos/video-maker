import type { Timeline } from '@video-maker/timeline-core';

export interface RenderRequest {
  readonly outPath: string;
  readonly publicDir: string;
}

export interface RenderOutcome {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export type TimelineRenderer = (timeline: Timeline, request: RenderRequest) => Promise<RenderOutcome>;

export interface MixTimelineAudioRequest {
  readonly outPath: string;
  readonly projectRoot: string;
}

export type TimelineAudioMixer = (
  timeline: Timeline,
  request: MixTimelineAudioRequest,
) => Promise<{ readonly outputPath: string }>;

export interface MuxRequest {
  readonly videoPath: string;
  readonly audioPath: string;
  readonly outPath: string;
}

export type AudioVideoMuxer = (request: MuxRequest) => Promise<{ readonly outputPath: string }>;

export interface MixLoudnessReport {
  readonly withinTolerance: boolean;
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
  readonly integratedDeltaLu: number;
  readonly truePeakDeltaDb: number;
}

export type MixLoudnessVerifier = (timeline: Timeline, path: string) => Promise<MixLoudnessReport>;
