import type { Db, Fps, GainKeyframe } from '@video-maker/timeline-core';

import { gainDbToVolume } from './gain-db-to-volume';

export interface GainAutomationSegment {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly startGainDb: Db;
  readonly slopeDbPerSecond: number;
}

export type GainAutomationCurve =
  | { readonly kind: 'constant'; readonly volume: number }
  | {
      readonly kind: 'piecewise';
      readonly firstSeconds: number;
      readonly firstGainDb: Db;
      readonly lastSeconds: number;
      readonly lastGainDb: Db;
      readonly segments: readonly GainAutomationSegment[];
    };

function buildPiecewiseCurve(automation: readonly GainKeyframe[], fps: Fps): GainAutomationCurve {
  const segments: GainAutomationSegment[] = [];
  let firstSeconds = 0;
  let firstGainDb: Db = 0;
  let lastSeconds = 0;
  let lastGainDb: Db = 0;

  automation.forEach((current, index) => {
    const currentSeconds = current.frame / fps;

    if (index === 0) {
      firstSeconds = currentSeconds;
      firstGainDb = current.gainDb;
    }

    lastSeconds = currentSeconds;
    lastGainDb = current.gainDb;

    const next = automation[index + 1];

    if (next === undefined) {
      return;
    }

    const nextSeconds = next.frame / fps;
    const span = nextSeconds - currentSeconds;
    const slopeDbPerSecond = span === 0 ? 0 : (next.gainDb - current.gainDb) / span;

    segments.push({
      startSeconds: currentSeconds,
      endSeconds: nextSeconds,
      startGainDb: current.gainDb,
      slopeDbPerSecond,
    });
  });

  return { kind: 'piecewise', firstSeconds, firstGainDb, lastSeconds, lastGainDb, segments };
}

export function buildGainAutomationCurve(
  automation: readonly GainKeyframe[],
  fps: Fps,
): GainAutomationCurve {
  if (automation.length < 2) {
    return { kind: 'constant', volume: gainDbToVolume(automation[0]?.gainDb ?? 0) };
  }

  return buildPiecewiseCurve(automation, fps);
}

export function evaluateGainAutomationCurve(curve: GainAutomationCurve, seconds: number): number {
  if (curve.kind === 'constant') {
    return curve.volume;
  }

  if (seconds <= curve.firstSeconds) {
    return gainDbToVolume(curve.firstGainDb);
  }

  if (seconds >= curve.lastSeconds) {
    return gainDbToVolume(curve.lastGainDb);
  }

  const gainDb = curve.segments.reduce((accumulatedGainDb, segment) => {
    if (seconds >= segment.startSeconds && seconds < segment.endSeconds) {
      return segment.startGainDb + segment.slopeDbPerSecond * (seconds - segment.startSeconds);
    }

    return accumulatedGainDb;
  }, curve.lastGainDb);

  return gainDbToVolume(gainDb);
}

export function isIdentityGainCurve(curve: GainAutomationCurve): boolean {
  return curve.kind === 'constant' && curve.volume === 1;
}
