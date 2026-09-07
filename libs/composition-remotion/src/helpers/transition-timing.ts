import { linearTiming, springTiming } from '@remotion/transitions';
import type { TransitionTiming as RemotionTiming } from '@remotion/transitions';
import type { Fps, TimelineTransition } from '@video-maker/timeline-core';

const MAX_TRANSITION_SECONDS = 2;

export function transitionTiming(transition: TimelineTransition, fps: Fps): RemotionTiming {
  const durationInFrames = clampTransitionFrames(transition.durationFrames, fps);
  if (transition.timing.type === 'linear') {
    return linearTiming({ durationInFrames });
  }

  const { damping, stiffness, mass } = transition.timing;
  return springTiming({
    config: { damping, stiffness, mass },
    durationInFrames,
  });
}

function clampTransitionFrames(durationFrames: number, fps: Fps): number {
  return Math.max(1, Math.min(durationFrames, fps * MAX_TRANSITION_SECONDS));
}
