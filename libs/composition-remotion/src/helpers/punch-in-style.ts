import type { CSSProperties } from 'react';
import type { PunchInAnchor } from '@video-maker/timeline-core';
import type { ClipTransform } from './timeline-types';

const TRANSFORM_ORIGIN_BY_ANCHOR: Record<PunchInAnchor, string> = {
  center: '50% 50%',
  top: '50% 0%',
  'face-hint': '50% 33%',
};

export function punchInStyle(transform: ClipTransform, anchor?: PunchInAnchor): CSSProperties {
  return {
    transform: `scale(${transform.scale}) translate(${transform.translateX}px, ${transform.translateY}px)`,
    transformOrigin: TRANSFORM_ORIGIN_BY_ANCHOR[anchor ?? 'center'],
  };
}
