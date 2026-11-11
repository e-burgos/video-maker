import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { lightLeak } from './light-leak';
import { whipPan } from './whip-pan';
import type { TransitionDirection, TransitionKind } from '../helpers/timeline-types';

export type ArollPresentation =
  | ReturnType<typeof fade>
  | ReturnType<typeof slide>
  | ReturnType<typeof whipPan>
  | ReturnType<typeof lightLeak>;

const DEFAULT_WHIP_PAN_DIRECTION: TransitionDirection = 'from-right';

export function presentationFor(
  kind: TransitionKind,
  direction: TransitionDirection | null,
): ArollPresentation {
  switch (kind) {
    case 'slide':
      return direction === null ? slide() : slide({ direction });
    case 'whip-pan':
      return whipPan({ direction: direction ?? DEFAULT_WHIP_PAN_DIRECTION });
    case 'light-leak':
      return lightLeak();
    case 'fade':
    default:
      return fade();
  }
}
