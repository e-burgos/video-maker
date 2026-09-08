import type { AudioClip, AudioMixPlan, Fps, Frame } from '@video-maker/timeline-core';

import { formatFilterNumber } from './format-filter-number';
import { gainDbToVolume } from './gain-db-to-volume';
import {
  buildGainAutomationCurve,
  isIdentityGainCurve,
} from './gain-automation-curve';
import { serializeGainAutomationCurve } from './serialize-gain-automation-curve';

export interface MusicBedChainOptions {
  readonly clip: AudioClip;
  readonly fps: Fps;
  readonly videoDurationFrames: Frame;
}

function buildGainFilters(plan: AudioMixPlan, clip: AudioClip, fps: Fps): string[] {
  const curve =
    plan.automation.length > 0
      ? buildGainAutomationCurve(plan.automation, fps)
      : { kind: 'constant' as const, volume: gainDbToVolume(clip.gainDb) };

  return isIdentityGainCurve(curve) ? [] : [serializeGainAutomationCurve(curve)];
}

function buildFadeFilters(clip: AudioClip, fps: Fps): string[] {
  const filters: string[] = [];

  if (clip.fadeInFrames !== undefined) {
    const start = clip.from / fps;
    const duration = clip.fadeInFrames / fps;

    filters.push(`afade=t=in:st=${formatFilterNumber(start)}:d=${formatFilterNumber(duration)}`);
  }

  if (clip.fadeOutFrames !== undefined) {
    const duration = clip.fadeOutFrames / fps;
    const start = (clip.from + clip.durationFrames) / fps - duration;

    filters.push(`afade=t=out:st=${formatFilterNumber(start)}:d=${formatFilterNumber(duration)}`);
  }

  return filters;
}

export function buildMusicBedChain(plan: AudioMixPlan, opts: MusicBedChainOptions): string[] {
  const { clip, fps, videoDurationFrames } = opts;

  return [
    ...buildGainFilters(plan, clip, fps),
    ...buildFadeFilters(clip, fps),
    'apad',
    `atrim=end=${formatFilterNumber(videoDurationFrames / fps)}`,
  ];
}
