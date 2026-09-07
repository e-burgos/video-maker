import { AbsoluteFill } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { whipPanStyle } from './whip-pan-style';
import type { TransitionDirection } from '../helpers/timeline-types';

export type WhipPanProps = {
  direction: TransitionDirection;
  maxBlurPx?: number;
};

function WhipPanPresentation({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}: TransitionPresentationComponentProps<WhipPanProps>) {
  const style = whipPanStyle(
    passedProps.direction,
    presentationDirection,
    presentationProgress,
    passedProps.maxBlurPx,
  );

  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}

export function whipPan(props: WhipPanProps): TransitionPresentation<WhipPanProps> {
  return {
    component: WhipPanPresentation,
    props,
  };
}
