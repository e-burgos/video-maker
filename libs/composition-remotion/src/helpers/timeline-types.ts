import type { CaptionClip, TimelineTransition, VideoClip } from '@video-maker/timeline-core';

export type ClipTransform = VideoClip['transform'];
export type ClipFit = NonNullable<VideoClip['fit']>;
export type CaptionWord = CaptionClip['words'][number];
export type CaptionBox = NonNullable<CaptionClip['box']>;
export type TransitionKind = TimelineTransition['kind'];
export type TransitionDirection = NonNullable<TimelineTransition['direction']>;
export type TimelineTiming = TimelineTransition['timing'];
