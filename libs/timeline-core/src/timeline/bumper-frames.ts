import type { LogoBumper, Timeline } from '../schemas/timeline.schema';
import type { Fps, Frame } from '../types/units';

export function logoBumperFrames(bumper: LogoBumper | undefined, fps: Fps): Frame {
  if (bumper === undefined || !bumper.enabled) {
    return 0;
  }

  return Math.round((bumper.durationMs / 1000) * fps);
}

export function introBumperFrames(timeline: Timeline): Frame {
  return logoBumperFrames(timeline.bumpers?.intro, timeline.format.fps);
}

export function outroBumperFrames(timeline: Timeline): Frame {
  return logoBumperFrames(timeline.bumpers?.outro, timeline.format.fps);
}

export function timelineTotalFrames(timeline: Timeline): Frame {
  return introBumperFrames(timeline) + timeline.durationFrames + outroBumperFrames(timeline);
}
