import { MOTION_MUSIC_TRACK_VOLUME } from '@video-maker/motion-graphics';
import { z } from 'zod';

import type { LevelPlan } from './level-plan';
import type { SecondsRange } from './review-inputs';

const GAIN_SAMPLES_PER_SEGMENT = 8;
const SILENT_VOLUME_FLOOR = 1e-6;
export const MOTION_AUDIO_DIRECTORY = 'assets/audio';
export const MOTION_MUSIC_FILE = `${MOTION_AUDIO_DIRECTORY}/music.wav`;

export const MotionReviewTimelineSchema = z.object({
  duration: z.number().positive(),
  scenes: z.array(z.object({ id: z.string().min(1), voStart: z.number(), voDuration: z.number().positive() })),
  musicAutomation: z.object({
    lanes: z.array(z.object({ target: z.string(), points: z.array(z.object({ t: z.number(), v: z.number() })) })),
  }),
});

export type MotionReviewTimeline = z.infer<typeof MotionReviewTimelineSchema>;
type AutomationPoint = { readonly t: number; readonly v: number };

export function motionVoiceFile(sceneId: string): string {
  return `${MOTION_AUDIO_DIRECTORY}/vo-${sceneId}.wav`;
}

function volumeAt(points: readonly AutomationPoint[], second: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return 1;
  }
  if (second <= first.t) {
    return first.v;
  }
  if (second >= last.t) {
    return last.v;
  }
  const nextIndex = points.findIndex((point) => point.t > second);
  const previous = points[nextIndex - 1] as AutomationPoint;
  const next = points[nextIndex] as AutomationPoint;
  return previous.v + ((next.v - previous.v) * (second - previous.t)) / (next.t - previous.t);
}

export function peakMotionMusicGainDb(timeline: MotionReviewTimeline, segment: SecondsRange): number {
  const points = timeline.musicAutomation.lanes.find((lane) => lane.target === 'volume')?.points ?? [];
  const step = (segment.endSec - segment.startSec) / GAIN_SAMPLES_PER_SEGMENT;
  const peak = Math.max(
    ...Array.from({ length: GAIN_SAMPLES_PER_SEGMENT + 1 }, (_, index) => volumeAt(points, segment.startSec + step * index)),
  );
  return 20 * Math.log10(Math.max(MOTION_MUSIC_TRACK_VOLUME * peak, SILENT_VOLUME_FLOOR));
}

export function buildMotionLevelPlans(
  timeline: MotionReviewTimeline,
  workDirectory: string,
  hasMusic: boolean,
): LevelPlan[] {
  return timeline.scenes.map((scene) => {
    const segment = { startSec: scene.voStart, endSec: scene.voStart + scene.voDuration };
    return {
      ...segment,
      voice: { path: `${workDirectory}/${motionVoiceFile(scene.id)}`, startSec: 0, endSec: scene.voDuration },
      voiceNormalization: null,
      music: hasMusic ? { path: `${workDirectory}/${MOTION_MUSIC_FILE}`, ...segment } : null,
      musicGainDb: peakMotionMusicGainDb(timeline, segment),
    };
  });
}
