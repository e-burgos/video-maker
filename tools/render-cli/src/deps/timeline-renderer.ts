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
