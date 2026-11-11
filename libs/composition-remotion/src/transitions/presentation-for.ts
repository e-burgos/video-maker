import { clockWipe } from '@remotion/transitions/clock-wipe';
import { fade } from '@remotion/transitions/fade';
import { flip } from '@remotion/transitions/flip';
import { iris } from '@remotion/transitions/iris';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { lightLeak } from './light-leak';
import { whipPan } from './whip-pan';
import type { TransitionDirection, TransitionKind } from '../helpers/timeline-types';

export type ArollPresentation =
  | ReturnType<typeof fade>
  | ReturnType<typeof slide>
  | ReturnType<typeof whipPan>
  | ReturnType<typeof lightLeak>
  | ReturnType<typeof wipe>
  | ReturnType<typeof flip>
  | ReturnType<typeof clockWipe>
  | ReturnType<typeof iris>;

export interface FrameSize {
  width: number;
  height: number;
}

const DEFAULT_WHIP_PAN_DIRECTION: TransitionDirection = 'from-right';
const DEFAULT_FRAME_SIZE: FrameSize = { width: 1920, height: 1080 };

export function presentationFor(
  kind: TransitionKind,
  direction: TransitionDirection | null,
  frameSize: FrameSize = DEFAULT_FRAME_SIZE,
): ArollPresentation {
  switch (kind) {
    case 'slide':
      return direction === null ? slide() : slide({ direction });
    case 'whip-pan':
      return whipPan({ direction: direction ?? DEFAULT_WHIP_PAN_DIRECTION });
    case 'light-leak':
      return lightLeak();
    case 'wipe':
      return direction === null ? wipe() : wipe({ direction });
    case 'flip':
      return direction === null ? flip() : flip({ direction });
    case 'clock-wipe':
      return clockWipe({ width: frameSize.width, height: frameSize.height });
    case 'iris':
      return iris({ width: frameSize.width, height: frameSize.height });
    case 'fade':
    default:
      return fade();
  }
}
