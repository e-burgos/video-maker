import type { CaptionClip, OutputPreset, Timeline } from '@video-maker/timeline-core';
import { defaultFormat, safeZoneFor } from '@video-maker/timeline-core';

function withoutBox(caption: CaptionClip): CaptionClip {
  const withoutBoxKey: CaptionClip = { ...caption };
  delete withoutBoxKey.box;
  return withoutBoxKey;
}

export function applyOutputPreset(timeline: Timeline, preset: OutputPreset): Timeline {
  if (timeline.format.preset === preset) {
    return timeline;
  }

  const format = defaultFormat(preset);

  return {
    ...timeline,
    format,
    safeZone: safeZoneFor(format),
    tracks: {
      ...timeline.tracks,
      captions: timeline.tracks.captions.map(withoutBox),
    },
  };
}
