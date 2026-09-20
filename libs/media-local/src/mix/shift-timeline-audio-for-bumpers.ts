import type { AudioClip, Timeline } from '@video-maker/timeline-core';
import { introBumperFrames, timelineTotalFrames } from '@video-maker/timeline-core';

function shiftClips(clips: readonly AudioClip[], frames: number): AudioClip[] {
  return clips.map((clip) => ({ ...clip, from: clip.from + frames }));
}

export function shiftTimelineAudioForBumpers(timeline: Timeline): Timeline {
  const introFrames = introBumperFrames(timeline);
  const totalFrames = timelineTotalFrames(timeline);

  if (totalFrames === timeline.durationFrames) {
    return timeline;
  }

  return {
    ...timeline,
    durationFrames: totalFrames,
    tracks: {
      ...timeline.tracks,
      voice: shiftClips(timeline.tracks.voice, introFrames),
      music: shiftClips(timeline.tracks.music, introFrames),
    },
    audioMix: {
      ...timeline.audioMix,
      automation: timeline.audioMix.automation.map((keyframe) => ({
        ...keyframe,
        frame: keyframe.frame + introFrames,
      })),
    },
  };
}
