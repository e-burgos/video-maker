import { musicNormalizationGainDb } from '@video-maker/timeline-core';
import type { AudioClip, GainKeyframe, Timeline } from '@video-maker/timeline-core';

import { meanPowerDb, sampleTimes } from './gain-statistics';
import type { LevelPlan, SourceSlice } from './level-plan';
import type { SecondsRange } from './review-inputs';

const MIN_DUCKED_SEGMENT_SEC = 0.5;

type MediaLocal = typeof import('@video-maker/media-local');

export type ResolveAssetPath = (assetId: string) => string | null;

function framesToSec(frames: number, fps: number): number {
  return frames / fps;
}

export function duckedSegments(timeline: Timeline): SecondsRange[] {
  const { automation, music } = timeline.audioMix;
  const fps = timeline.format.fps;
  if (automation.length === 0) {
    return timeline.tracks.voice.map((clip) => ({
      startSec: framesToSec(clip.from, fps),
      endSec: framesToSec(clip.from + clip.durationFrames, fps),
    }));
  }
  const threshold = (music.baseGainDb + music.duckedGainDb) / 2;
  const sorted = [...automation].sort((a, b) => a.frame - b.frame);
  const runs: GainKeyframe[][] = [];
  let current: GainKeyframe[] = [];
  for (const keyframe of sorted) {
    if (keyframe.gainDb < threshold) {
      current.push(keyframe);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    runs.push(current);
  }
  return runs
    .map((run) => ({
      startSec: framesToSec(run[0]?.frame ?? 0, fps),
      endSec: framesToSec(run[run.length - 1]?.frame ?? 0, fps),
    }))
    .filter((segment) => segment.endSec - segment.startSec >= MIN_DUCKED_SEGMENT_SEC);
}

function effectiveAutomationGainDb(media: MediaLocal, timeline: Timeline, segment: SecondsRange): number {
  const { buildGainAutomationCurve, evaluateGainAutomationCurve } = media;
  const curve = buildGainAutomationCurve(timeline.audioMix.automation, timeline.format.fps);
  return meanPowerDb(sampleTimes(segment.startSec, segment.endSec).map((second) => evaluateGainAutomationCurve(curve, second)));
}

function clipContaining(clips: readonly AudioClip[], second: number, fps: number): AudioClip | null {
  return (
    clips.find(
      (clip) => second >= framesToSec(clip.from, fps) && second < framesToSec(clip.from + clip.durationFrames, fps),
    ) ?? null
  );
}

function sliceOf(
  clip: AudioClip | null,
  segment: SecondsRange,
  fps: number,
  resolvePath: ResolveAssetPath,
): SourceSlice | null {
  const path = clip === null ? null : resolvePath(clip.assetId);
  if (clip === null || path === null) {
    return null;
  }
  const offset = clip.trimStartMs / 1000 - framesToSec(clip.from, fps);
  return { path, startSec: segment.startSec + offset, endSec: segment.endSec + offset };
}

function wholeAssetSlice(timeline: Timeline, assetId: string, resolvePath: ResolveAssetPath): SourceSlice | null {
  const path = resolvePath(assetId);
  const asset = timeline.assets.find((candidate) => candidate.id === assetId);
  return path === null || asset === undefined ? null : { path, startSec: 0, endSec: asset.durationMs / 1000 };
}

function musicGainDb(media: MediaLocal, timeline: Timeline, clip: AudioClip | null, segment: SecondsRange): number {
  if (clip === null) {
    return 0;
  }
  const measuredLufs = timeline.assets.find((asset) => asset.id === clip.assetId)?.audio?.integratedLufs;
  const normalizationDb = musicNormalizationGainDb(measuredLufs, timeline.audioMix.music.referenceLufs);
  const mixDb =
    timeline.audioMix.automation.length > 0 ? effectiveAutomationGainDb(media, timeline, segment) : clip.gainDb;
  return normalizationDb + mixDb;
}

export async function buildFootageLevelPlans(timeline: Timeline, resolvePath: ResolveAssetPath): Promise<LevelPlan[]> {
  const media = await import('@video-maker/media-local');
  const fps = timeline.format.fps;
  return duckedSegments(timeline).map((segment) => {
    const middle = (segment.startSec + segment.endSec) / 2;
    const voiceClip = clipContaining(timeline.tracks.voice, middle, fps);
    const musicClip = clipContaining(timeline.tracks.music, middle, fps);
    const whole = voiceClip === null ? null : wholeAssetSlice(timeline, voiceClip.assetId, resolvePath);
    return {
      ...segment,
      voice: sliceOf(voiceClip, segment, fps, resolvePath),
      voiceNormalization: whole === null ? null : { whole, targetLufs: timeline.audioMix.voice.integratedLufs },
      music: sliceOf(musicClip, segment, fps, resolvePath),
      musicGainDb: musicGainDb(media, timeline, musicClip, segment),
    };
  });
}
