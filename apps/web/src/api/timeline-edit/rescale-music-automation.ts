import type { GainKeyframe } from '@video-maker/timeline-core';

export type MusicLevels = { baseGainDb: number; duckedGainDb: number };

export type AutomationRescale = { automation: GainKeyframe[]; rescaled: boolean };

export function rescaleMusicAutomation(
  automation: readonly GainKeyframe[],
  previous: MusicLevels,
  next: MusicLevels,
): AutomationRescale {
  const span = previous.baseGainDb - previous.duckedGainDb;

  if (span === 0) {
    return { automation: [...automation], rescaled: false };
  }

  const rescaled = automation.map((keyframe) => {
    const t = (keyframe.gainDb - previous.duckedGainDb) / span;
    return {
      frame: keyframe.frame,
      gainDb: next.duckedGainDb + t * (next.baseGainDb - next.duckedGainDb),
    };
  });

  return { automation: rescaled, rescaled: true };
}
