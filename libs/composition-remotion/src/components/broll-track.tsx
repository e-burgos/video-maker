import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence } from 'remotion';
import type { VideoSequenceProps } from '../helpers/timeline-to-sequence-props';

export interface BrollTrackProps {
  clips: readonly VideoSequenceProps[];
}

const PIP_WIDTH_RATIO = 0.32;
const PIP_MARGIN_RATIO = 0.05;

const COVER_MEDIA_STYLE: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
const CONTAIN_MEDIA_STYLE: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' };
const PIP_MEDIA_STYLE: CSSProperties = { width: '100%', display: 'block' };

const PIP_WRAPPER_STYLE: CSSProperties = {
  position: 'absolute',
  right: `${PIP_MARGIN_RATIO * 100}%`,
  bottom: `${PIP_MARGIN_RATIO * 100}%`,
  width: `${PIP_WIDTH_RATIO * 100}%`,
  overflow: 'hidden',
  borderRadius: 12,
};

function mediaStyleFor(fit: VideoSequenceProps['fit']): CSSProperties {
  if (fit === 'contain') {
    return CONTAIN_MEDIA_STYLE;
  }
  if (fit === 'pip') {
    return PIP_MEDIA_STYLE;
  }
  return COVER_MEDIA_STYLE;
}

const BrollMedia: FC<{ clip: VideoSequenceProps; style: CSSProperties }> = ({ clip, style }) => {
  if (clip.kind === 'video') {
    return <OffthreadVideo src={clip.src} trimBefore={clip.trimBefore} muted style={style} />;
  }
  if (clip.kind === 'image') {
    return <Img src={clip.src} style={style} />;
  }
  return null;
};

const BrollClip: FC<{ clip: VideoSequenceProps }> = ({ clip }) => {
  const media = <BrollMedia clip={clip} style={mediaStyleFor(clip.fit)} />;

  if (clip.fit === 'pip') {
    return <div style={PIP_WRAPPER_STYLE}>{media}</div>;
  }

  return <AbsoluteFill>{media}</AbsoluteFill>;
};

export const BrollTrack: FC<BrollTrackProps> = ({ clips }) => (
  <>
    {clips.map((clip) => (
      <Sequence key={clip.clipId} from={clip.from} durationInFrames={clip.durationInFrames}>
        <BrollClip clip={clip} />
      </Sequence>
    ))}
  </>
);
