import type { FC } from 'react';
import { Composition } from 'remotion';
import { defaultFormat } from '@video-maker/timeline-core';
import { buildExampleTimeline } from './__fixtures__/example-timeline';
import type { CaptionPresetGalleryProps } from './components/caption-preset-gallery';
import { CAPTION_PRESET_GALLERY_ID, CaptionPresetGallery } from './components/caption-preset-gallery';
import { TIMELINE_COMPOSITION_ID, TimelineComposition, calculateTimelineMetadata } from './components/timeline-composition';
import { timelineToSequenceProps } from './helpers/timeline-to-sequence-props';

const CAPTION_PRESET_GALLERY_DEFAULT_PROPS: CaptionPresetGalleryProps = {
  clips: timelineToSequenceProps(buildExampleTimeline('reels-9x16')).captions,
  format: defaultFormat('reels-9x16'),
};

export const RemotionRoot: FC = () => (
  <>
    <Composition
      id={TIMELINE_COMPOSITION_ID}
      component={TimelineComposition}
      calculateMetadata={calculateTimelineMetadata}
      defaultProps={{ timeline: buildExampleTimeline('reels-9x16') }}
      durationInFrames={265}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="TimelineCompositionLandscape"
      component={TimelineComposition}
      calculateMetadata={calculateTimelineMetadata}
      defaultProps={{ timeline: buildExampleTimeline('youtube-16x9') }}
      durationInFrames={265}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id={CAPTION_PRESET_GALLERY_ID}
      component={CaptionPresetGallery}
      defaultProps={CAPTION_PRESET_GALLERY_DEFAULT_PROPS}
      durationInFrames={265}
      fps={30}
      width={4320}
      height={1920}
    />
  </>
);
