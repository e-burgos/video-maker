import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { OutputFormat, SafeZone } from '@video-maker/timeline-core';
import { captionLayout } from '../helpers/caption-layout';
import type { CaptionBox } from '../helpers/timeline-types';
import type { CaptionSequenceProps } from '../helpers/timeline-to-sequence-props';

export interface CaptionTrackProps {
  clips: readonly CaptionSequenceProps[];
  safeZone: SafeZone;
  format: OutputFormat;
}

const CAPTION_FONT_SIZE_RATIO = 0.045;
const EMPHASIS_FONT_WEIGHT = 800;
const DEFAULT_FONT_WEIGHT = 600;

function boxStyle(box: CaptionBox, format: OutputFormat): CSSProperties {
  return {
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    fontSize: Math.round(format.height * CAPTION_FONT_SIZE_RATIO),
    color: '#ffffff',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.85)',
    textAlign: 'center',
  };
}

const CaptionWords: FC<{ clip: CaptionSequenceProps }> = ({ clip }) => (
  <>
    {clip.words.map((word, index) => (
      <span
        key={`${clip.clipId}-${index}`}
        style={{
          fontWeight: index === clip.emphasisIndex ? EMPHASIS_FONT_WEIGHT : DEFAULT_FONT_WEIGHT,
          marginRight: index < clip.words.length - 1 ? '0.3em' : 0,
        }}
      >
        {word.text}
      </span>
    ))}
  </>
);

export const CaptionTrack: FC<CaptionTrackProps> = ({ clips, safeZone, format }) => (
  <>
    {clips.map((clip) => {
      const box = clip.box ?? captionLayout(safeZone, format);
      return (
        <Sequence key={clip.clipId} from={clip.from} durationInFrames={clip.durationInFrames}>
          <AbsoluteFill>
            <div style={boxStyle(box, format)}>
              <CaptionWords clip={clip} />
            </div>
          </AbsoluteFill>
        </Sequence>
      );
    })}
  </>
);
