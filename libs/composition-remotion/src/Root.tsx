import type { FC } from 'react';
import { Composition } from 'remotion';
import { buildExampleTimeline } from './__fixtures__/example-timeline';
import { TIMELINE_COMPOSITION_ID, TimelineComposition, calculateTimelineMetadata } from './components/timeline-composition';

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
  </>
);
