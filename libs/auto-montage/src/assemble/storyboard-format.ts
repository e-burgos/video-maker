import type { OutputPreset, StoryboardFormat } from '@video-maker/timeline-core';

const OUTPUT_PRESET_BY_STORYBOARD_FORMAT: Record<StoryboardFormat, OutputPreset> = {
  '9:16': 'reels-9x16',
  '16:9': 'youtube-16x9',
  '1:1': 'reels-9x16',
};

export function outputPresetFor(format: StoryboardFormat): OutputPreset {
  return OUTPUT_PRESET_BY_STORYBOARD_FORMAT[format];
}
