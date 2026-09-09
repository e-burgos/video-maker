import type { Timeline } from '@video-maker/timeline-core';

export const TIMELINE_EDIT_REJECTION_CODES = [
  'TRIM_START_MS_INVALID',
  'DURATION_FRAMES_INVALID',
  'CAPTION_WORD_TEXT_EMPTY',
  'DURATION_SHORTER_THAN_TRANSITION',
] as const;

export type TimelineEditRejectionCode = (typeof TIMELINE_EDIT_REJECTION_CODES)[number];

export type TimelineEditRejection = {
  code: TimelineEditRejectionCode;
  path: string;
  message: string;
};

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function rejectTrimStartMs(value: number, path: string): TimelineEditRejection | null {
  if (isNonNegativeInteger(value)) {
    return null;
  }

  return {
    code: 'TRIM_START_MS_INVALID',
    path,
    message: `trimStartMs must be a non-negative integer, got ${value}.`,
  };
}

export function rejectDurationFrames(value: number, path: string): TimelineEditRejection | null {
  if (Number.isInteger(value) && value >= 1) {
    return null;
  }

  return {
    code: 'DURATION_FRAMES_INVALID',
    path,
    message: `durationFrames must be an integer of at least 1, got ${value}.`,
  };
}

export function rejectCaptionWordText(value: string, path: string): TimelineEditRejection | null {
  if (value.length >= 1) {
    return null;
  }

  return {
    code: 'CAPTION_WORD_TEXT_EMPTY',
    path,
    message: 'A caption word cannot be empty.',
  };
}

function transitionFramesTouching(timeline: Timeline, clipId: string, side: 0 | 1): number {
  const transitions = timeline.transitions ?? [];
  return transitions
    .filter((transition) => transition.betweenClipIds[side] === clipId)
    .reduce((sum, transition) => sum + transition.durationFrames, 0);
}

export function rejectDurationAgainstTransitions(
  timeline: Timeline,
  clipId: string,
  durationFrames: number,
): TimelineEditRejection | null {
  const outgoingFrames = transitionFramesTouching(timeline, clipId, 0);
  const enteringFrames = transitionFramesTouching(timeline, clipId, 1);
  const minimumDurationFrames = outgoingFrames + enteringFrames + 1;

  if (durationFrames >= minimumDurationFrames) {
    return null;
  }

  return {
    code: 'DURATION_SHORTER_THAN_TRANSITION',
    path: `clip:${clipId}`,
    message: `durationFrames must be at least ${minimumDurationFrames} to fit the transitions touching "${clipId}".`,
  };
}
