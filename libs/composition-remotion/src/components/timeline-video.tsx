import type { CSSProperties, FC } from 'react';
import { OffthreadVideo, Video } from 'remotion';
import type { VideoSequenceProps } from '../helpers/timeline-to-sequence-props';
import { useVideoBackend } from './video-backend';

export type TimelineVideoProps = {
  src: string;
  trimBefore: VideoSequenceProps['trimBefore'];
  style: CSSProperties;
};

const PLAYER_MEDIA_STYLE: CSSProperties = { objectFit: 'fill' };

export const TimelineVideo: FC<TimelineVideoProps> = ({ src, trimBefore, style }) => {
  const backend = useVideoBackend();

  if (backend === 'player') {
    return <Video src={src} trimBefore={trimBefore} muted style={{ ...PLAYER_MEDIA_STYLE, ...style }} />;
  }

  return <OffthreadVideo src={src} trimBefore={trimBefore} muted style={style} />;
};
