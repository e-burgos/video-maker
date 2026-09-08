import type { PunchInAnchor, Scale, VideoClip } from '@video-maker/timeline-core';

export type MontagePresetName = 'software-demo' | 'hardware' | 'recipe' | 'educational';
export type BrollRolePriority = readonly ['broll', 'image'] | readonly ['image', 'broll'];
export type TransitionKind = 'fade' | 'slide' | 'whip-pan' | 'light-leak';
export type ClipFit = NonNullable<VideoClip['fit']>;

export interface MontagePreset {
  readonly name: MontagePresetName;
  readonly silence: {
    readonly minSilenceMs: number;
    readonly paddingMs: number;
    readonly minKeepMs: number;
  };
  readonly punchIn: {
    readonly every: number;
    readonly scales: readonly [Scale, ...Scale[]];
    readonly anchor: PunchInAnchor;
  };
  readonly concepts: {
    readonly minFrequency: number;
    readonly minTermLength: number;
    readonly dictionary: readonly string[];
  };
  readonly broll: {
    readonly targetDurationMs: number;
    readonly minDurationMs: number;
    readonly maxDurationMs: number;
    readonly noRepeatWindowMs: number;
    readonly minGapMs: number;
    readonly maxCoverageRatio: number;
    readonly rolePriority: BrollRolePriority;
    readonly fit: ClipFit;
  };
  readonly captions: {
    readonly maxWords: 1 | 2 | 3;
    readonly maxDurationMs: number;
    readonly minDurationMs: number;
    readonly maxGapMs: number;
  };
  readonly transitions: {
    readonly every: number;
    readonly durationMs: number;
    readonly kinds: readonly [TransitionKind, ...TransitionKind[]];
    readonly timing: 'spring' | 'linear';
  };
  readonly audio: {
    readonly baseGainDb: number;
    readonly duckedGainDb: number;
    readonly attackMs: number;
    readonly releaseMs: number;
    readonly holdMs: number;
  };
}
